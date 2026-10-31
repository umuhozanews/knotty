param(
  [string]$DenoPath = "$env:USERPROFILE\.deno\bin\deno.exe"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$oldLocation = Get-Location
$ctxPath = Join-Path $env:TEMP "ishurihub-edge-local-context.json"
$envPath = Join-Path $env:TEMP "ishurihub-edge-local-secrets.env"
$stdoutPath = Join-Path $env:TEMP "ishurihub-edge-local.stdout.log"
$stderrPath = Join-Path $env:TEMP "ishurihub-edge-local.stderr.log"
$edgeProcess = $null
Add-Type -AssemblyName System.Net.Http
$http = [System.Net.Http.HttpClient]::new()

function Assert-That([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}

function Invoke-Json([string]$method, [string]$uri, [hashtable]$headers, [object]$body) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($method), $uri)
  foreach ($name in $headers.Keys) { [void]$request.Headers.TryAddWithoutValidation($name, [string]$headers[$name]) }
  if ($null -ne $body) {
    $request.Content = [System.Net.Http.StringContent]::new(
      ($body | ConvertTo-Json -Depth 12 -Compress), [Text.Encoding]::UTF8, "application/json"
    )
  }
  $response = $http.SendAsync($request).GetAwaiter().GetResult()
  return @{
    Status = [int]$response.StatusCode
    Body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  }
}

function Invoke-LocalPsql([string]$sql) {
  $output = & docker exec supabase_db_ishurihub psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -Atc $sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Local fixture SQL failed: $($output -join ' ')" }
  return @($output)
}

function Start-Function([string]$name) {
  $configPath = (Resolve-Path (Join-Path $repoRoot "supabase/functions/$name/deno.json")).Path
  $entryPath = (Resolve-Path (Join-Path $repoRoot "supabase/functions/$name/index.ts")).Path
  $script:edgeProcess = Start-Process -FilePath $DenoPath -WindowStyle Hidden -PassThru `
    -ArgumentList @("run", "--allow-env", "--allow-net", "--allow-read", "--config", $configPath, "--env-file=$envPath", $entryPath) `
    -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  for ($attempt = 0; $attempt -lt 80; $attempt++) {
    if ($script:edgeProcess.HasExited) { throw "$name Deno process exited before listening" }
    try {
      $probe = [System.Net.Sockets.TcpClient]::new()
      $probe.Connect("127.0.0.1", 8000)
      $probe.Dispose()
      return
    } catch { Start-Sleep -Milliseconds 250 }
  }
  throw "$name Deno process did not listen on port 8000"
}

function Stop-Function {
  if ($script:edgeProcess -and -not $script:edgeProcess.HasExited) {
    Stop-Process -Id $script:edgeProcess.Id -Force
    $script:edgeProcess.WaitForExit()
  }
  $script:edgeProcess = $null
}

function Invoke-Edge([string]$name, [object]$body, [string]$token = $null, [hashtable]$extraHeaders = @{}) {
  $headers = @{ Origin = "http://localhost:3000" }
  if ($token) { $headers.Authorization = "Bearer $token" }
  foreach ($key in $extraHeaders.Keys) { $headers[$key] = $extraHeaders[$key] }
  return Invoke-Json "POST" "http://127.0.0.1:8000/functions/v1/$name" $headers $body
}

function Invoke-ManagerRpc([string]$name, [object]$body) {
  $headers = @{ apikey = $script:context.AnonKey; Authorization = "Bearer $($script:context.AccessToken)" }
  return Invoke-Json "POST" "$($script:context.ApiUrl)/rest/v1/rpc/$name" $headers $body
}

try {
  Set-Location $repoRoot
  Assert-That (Test-Path $DenoPath) "Deno executable not found: $DenoPath"
  $env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $statusLines = npx supabase status -o env 2>$null
  $ErrorActionPreference = $previousErrorPreference
  $status = @{}
  foreach ($line in $statusLines) {
    if ($line -match '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=(.*)$') {
      $status[$Matches[1]] = $Matches[2].Trim('"')
    }
  }
  Assert-That ($status.API_URL -match '^http://(127\.0\.0\.1|localhost):') "Supabase API is not a local URL"
  Assert-That ([bool]$status.ANON_KEY) "Local anon key was not reported by Supabase CLI"
  Assert-That ([bool]$status.SERVICE_ROLE_KEY) "Local service key was not reported by Supabase CLI"

  $ids = @{}
  foreach ($key in @("Org", "School", "ManagerPerson", "StudentPerson", "SecondStudentPerson", "ManagerMembership", "StudentMembership", "SecondStudentMembership", "StudentRecord", "SecondStudentRecord")) {
    $ids[$key] = [guid]::NewGuid().ToString()
  }
  $suffix = [guid]::NewGuid().ToString("N")
  $managerEmail = "edge-manager-$suffix@example.invalid"
  $studentEmail = "edge-existing-student-$suffix@example.invalid"
  $password = "Test-" + [guid]::NewGuid().ToString("N") + "!aA9"
  $adminHeaders = @{ apikey = $status.ANON_KEY; Authorization = "Bearer $($status.SERVICE_ROLE_KEY)" }
  $managerCreated = Invoke-Json "POST" "$($status.API_URL)/auth/v1/admin/users" $adminHeaders `
    @{ email = $managerEmail; password = $password; email_confirm = $true }
  Assert-That ($managerCreated.Status -eq 200) "Local manager Auth user creation failed"
  $managerUserId = ($managerCreated.Body | ConvertFrom-Json).id
  $studentCreated = Invoke-Json "POST" "$($status.API_URL)/auth/v1/admin/users" $adminHeaders `
    @{ email = $studentEmail; password = $password; email_confirm = $true }
  Assert-That ($studentCreated.Status -eq 200) "Local card-holder Auth user creation failed"
  $studentUserId = ($studentCreated.Body | ConvertFrom-Json).id
  $secondStudentEmail = "edge-second-student-$suffix@example.invalid"
  $secondStudentCreated = Invoke-Json "POST" "$($status.API_URL)/auth/v1/admin/users" $adminHeaders `
    @{ email = $secondStudentEmail; password = $password; email_confirm = $true }
  Assert-That ($secondStudentCreated.Status -eq 200) "Local duplicate-test student Auth user creation failed"
  $secondStudentUserId = ($secondStudentCreated.Body | ConvertFrom-Json).id
  $login = Invoke-Json "POST" "$($status.API_URL)/auth/v1/token?grant_type=password" `
    @{ apikey = $status.ANON_KEY } @{ email = $managerEmail; password = $password }
  Assert-That ($login.Status -eq 200) "Local manager sign-in failed"
  $accessToken = ($login.Body | ConvertFrom-Json).access_token

  $schoolCode = "EDGE-$suffix"
  $schoolEmail = "edge-school-$suffix@example.invalid"
  $sql = @"
insert into public.organizations(id,name,slug) values ('$($ids.Org)','Local Edge Runtime Test Org','edge-runtime-$suffix');
insert into public.schools(id,organization_id,name,code,email) values ('$($ids.School)','$($ids.Org)','Local Edge Runtime Test School','$schoolCode','$schoolEmail');
insert into public.school_settings(school_id) values ('$($ids.School)');
insert into public.persons(id,auth_user_id) values ('$($ids.ManagerPerson)','$managerUserId'),('$($ids.StudentPerson)','$studentUserId'),('$($ids.SecondStudentPerson)','$secondStudentUserId');
insert into public.school_memberships(id,school_id,person_id,status,started_at) values ('$($ids.ManagerMembership)','$($ids.School)','$($ids.ManagerPerson)','active',now()),('$($ids.StudentMembership)','$($ids.School)','$($ids.StudentPerson)','active',now()),('$($ids.SecondStudentMembership)','$($ids.School)','$($ids.SecondStudentPerson)','active',now());
insert into public.school_membership_roles(school_id,membership_id,person_id,role_key,assigned_by_membership_id,assigned_by_person_id,assigned_reason) values ('$($ids.School)','$($ids.ManagerMembership)','$($ids.ManagerPerson)','SCHOOL_MANAGER','$($ids.ManagerMembership)','$($ids.ManagerPerson)','isolated local Edge integration fixture');
insert into public.student_records(id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id) values ('$($ids.StudentRecord)','$($ids.School)','$($ids.StudentPerson)','$studentUserId','$($ids.StudentMembership)','EDGE-EXISTING-$suffix','active','$($ids.ManagerMembership)','$($ids.ManagerPerson)');
insert into public.student_records(id,school_id,person_id,auth_user_id,school_membership_id,admission_number,status,created_by_membership_id,created_by_person_id) values ('$($ids.SecondStudentRecord)','$($ids.School)','$($ids.SecondStudentPerson)','$secondStudentUserId','$($ids.SecondStudentMembership)','EDGE-SECOND-$suffix','active','$($ids.ManagerMembership)','$($ids.ManagerPerson)');
"@
  [void](Invoke-LocalPsql $sql)

  $keyBytes = [byte[]]::new(32)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($keyBytes)
  $hmacKey = [Convert]::ToBase64String($keyBytes)
  @(
    "SUPABASE_URL=$($status.API_URL)",
    "SUPABASE_ANON_KEY=$($status.ANON_KEY)",
    "SUPABASE_SERVICE_ROLE_KEY=$($status.SERVICE_ROLE_KEY)",
    "CARD_IDENTIFIER_HMAC_KEY=$hmacKey",
    "ATTENDANCE_SCAN_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000",
    "APP_ORIGIN=http://localhost:3000"
  ) | Set-Content -LiteralPath $envPath -Encoding ascii
  $script:context = @{
    ApiUrl = $status.API_URL; AnonKey = $status.ANON_KEY; AccessToken = $accessToken
    SchoolId = $ids.School; StudentId = $ids.StudentRecord; HmacKey = $hmacKey
  }

  # Student provisioning: execute the mutation and inspect the linked rows/audit.
  Start-Function "provision-student"
  $provisionContact = "edge-new-student-$suffix@example.invalid"
  $provision = Invoke-Edge "provision-student" @{
    school_id = $ids.School; contact_type = "email"; contact = $provisionContact
    admission_number = "EDGE-NEW-$suffix"; legal_name = "Edge Integration Student"
    date_of_birth = "2014-03-12"; gender = "female"; nationality = "Rwandan"
  } $accessToken
  $missingAuth = Invoke-Edge "provision-student" @{} $null
  $missingFields = Invoke-Edge "provision-student" @{ school_id = $ids.School } $accessToken
  $invalidSession = Invoke-Edge "provision-student" @{
    school_id = $ids.School; contact_type = "email"; contact = "invalid-session-$suffix@example.invalid"
    admission_number = "INVALID-SESSION-$suffix"; legal_name = "Invalid Session Test"
  } "invalid-session-token"
  Stop-Function
  Assert-That ($provision.Status -eq 201) "Student provisioning failed: $($provision.Body)"
  Assert-That ($missingAuth.Status -eq 401) "Unauthenticated provisioning was not denied"
  Assert-That ($missingFields.Status -eq 400) "Missing provisioning fields were not rejected"
  Assert-That ($invalidSession.Status -eq 401) "Invalid provisioning session was not denied (HTTP $($invalidSession.Status): $($invalidSession.Body))"
  $newStudentId = ($provision.Body | ConvertFrom-Json).student_id
  $provisionRows = Invoke-LocalPsql "select 'person='||count(*) from public.student_records where id='$newStudentId' and school_id='$($ids.School)' and status='pending'; select 'membership='||count(*) from public.school_memberships sm join public.student_records sr on sr.school_membership_id=sm.id where sr.id='$newStudentId' and sm.status='invited'; select 'audit='||count(*) from public.school_operation_audit where entity_id='$newStudentId' and event_type='student_registered';"
  Assert-That (($provisionRows -join ",") -eq "person=1,membership=1,audit=1") "Student provisioning rows or audit did not match the expected effects"
  Write-Output "provision-student: 201, pending student/person/membership and registration audit verified; missing auth 401"

  # Card issue, duplicate identifier rejection, activation, and replacement.
  $identifier = "edge-nfc-$suffix"
  Start-Function "issue-card"
  $issue = Invoke-Edge "issue-card" @{
    school_id = $ids.School; holder_kind = "student"; student_id = $ids.StudentRecord
    identifier_kind = "nfc_uid"; identifier = $identifier
  } $accessToken
  $issueDuplicate = Invoke-Edge "issue-card" @{
    school_id = $ids.School; holder_kind = "student"; student_id = $ids.SecondStudentRecord
    identifier_kind = "nfc_uid"; identifier = $identifier
  } $accessToken
  $issueDenied = Invoke-Edge "issue-card" @{
    school_id = [guid]::NewGuid().ToString(); holder_kind = "student"; student_id = $ids.StudentRecord
    identifier_kind = "nfc_uid"; identifier = "denied-$suffix"
  } $accessToken
  Stop-Function
  Assert-That ($issue.Status -eq 201) "Card issue failed: $($issue.Body)"
  Assert-That ($issueDuplicate.Status -eq 422) "Duplicate card identifier was not rejected"
  Assert-That ($issueDenied.Status -eq 403) "Non-member school access was not denied"
  $oldCardId = ($issue.Body | ConvertFrom-Json).card_assignment_id
  $issueRows = Invoke-LocalPsql "select 'card='||count(*) from public.card_assignments where id='$oldCardId' and school_id='$($ids.School)'; select 'identifier='||count(*) from public.card_identifiers where card_assignment_id='$oldCardId' and status='active'; select 'audit='||count(*) from public.school_operation_audit where entity_id='$oldCardId' and event_type='card_issued';"
  Assert-That (($issueRows -join ",") -eq "card=1,identifier=1,audit=1") "Card issue mutation/audit mismatch"
  $activation = Invoke-ManagerRpc "activate_card" @{ p_school_id = $ids.School; p_card_assignment_id = $oldCardId }
  Assert-That ($activation.Status -eq 204 -or $activation.Status -eq 200) "Card activation RPC failed"

  Start-Function "replace-card"
  $replace = Invoke-Edge "replace-card" @{
    school_id = $ids.School; old_card_assignment_id = $oldCardId
    identifier_kind = "nfc_uid"; identifier = "edge-replacement-$suffix"
    reason = "local integration card replacement"
  } $accessToken
  $replaceDuplicate = Invoke-Edge "replace-card" @{
    school_id = $ids.School; old_card_assignment_id = $oldCardId
    identifier_kind = "nfc_uid"; identifier = "edge-replacement-retry-$suffix"
    reason = "repeat replacement request"
  } $accessToken
  Stop-Function
  Assert-That ($replace.Status -eq 201) "Card replacement failed: $($replace.Body)"
  Assert-That ($replaceDuplicate.Status -eq 422) "Repeated replacement was not rejected"
  $newCardId = ($replace.Body | ConvertFrom-Json).card_assignment_id
  $replacementRows = Invoke-LocalPsql "select 'link='||count(*) from public.card_assignments where id='$oldCardId' and status='replaced' and replacement_card_id='$newCardId'; select 'new='||count(*) from public.card_assignments where id='$newCardId' and status='issued'; select 'audit='||count(*) from public.school_operation_audit where entity_id='$oldCardId' and event_type='card_replaced'; select 'history='||count(*) from public.card_lifecycle_events where card_assignment_id in ('$oldCardId','$newCardId');"
  Assert-That (($replacementRows -join ",") -eq "link=1,new=1,audit=1,history=4") "Card replacement linkage or audit/history mismatch"
  Write-Output "issue-card: 201 and persisted lifecycle/audit verified; cross-holder duplicate identifier 422; non-member 403"
  Write-Output "replace-card: 201 and old/new linkage/lifecycle/audit verified; replay after replacement 422"

  # Restore the replacement card to active state, then exercise real device auth,
  # accepted/replayed/duplicate/rejected scans, and bounded response data.
  $newCardActivation = Invoke-ManagerRpc "activate_card" @{ p_school_id = $ids.School; p_card_assignment_id = $newCardId }
  Assert-That ($newCardActivation.Status -eq 204 -or $newCardActivation.Status -eq 200) "Replacement card activation RPC failed"
  $deviceCredential = "dev-" + [guid]::NewGuid().ToString("N") + "-local-runtime"
  $sha256 = [Security.Cryptography.SHA256]::Create()
  $deviceDigest = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($deviceCredential))
  $sha256.Dispose()
  $deviceHex = [BitConverter]::ToString($deviceDigest).Replace("-", "").ToLowerInvariant()
  $deviceResponse = Invoke-ManagerRpc "register_attendance_device" @{
    p_school_id = $ids.School; p_device_code = "EDGE-DEVICE-$suffix"
    p_device_kind = "mobile"; p_credential_digest = "\x$deviceHex"
  }
  Assert-That ($deviceResponse.Status -eq 200) "Attendance device registration failed"
  $deviceId = $deviceResponse.Body.Trim('"')
  Start-Function "process-attendance-scan"
  $idempotencyKey = [guid]::NewGuid().ToString()
  $scanBody = @{
    school_id = $ids.School; device_id = $deviceId; card_identifier = "edge-replacement-$suffix"
    idempotency_key = $idempotencyKey; direction = "in"
  }
  $scan = Invoke-Edge "process-attendance-scan" $scanBody $null @{ "x-device-credential" = $deviceCredential }
  $scanReplay = Invoke-Edge "process-attendance-scan" $scanBody $null @{ "x-device-credential" = $deviceCredential }
  $duplicateScan = Invoke-Edge "process-attendance-scan" @{
    school_id = $ids.School; device_id = $deviceId; card_identifier = "edge-replacement-$suffix"
    idempotency_key = [guid]::NewGuid().ToString(); direction = "in"
  } $null @{ "x-device-credential" = $deviceCredential }
  $rejectedScan = Invoke-Edge "process-attendance-scan" @{
    school_id = $ids.School; device_id = $deviceId; card_identifier = "unknown-$suffix"
    idempotency_key = [guid]::NewGuid().ToString(); direction = "in"
  } $null @{ "x-device-credential" = $deviceCredential }
  $invalidDevice = Invoke-Edge "process-attendance-scan" @{
    school_id = $ids.School; device_id = $deviceId; card_identifier = "unknown-$suffix"
    idempotency_key = [guid]::NewGuid().ToString(); direction = "in"
  } $null @{ "x-device-credential" = "invalid-device-credential" }
  Stop-Function
  Assert-That ($scan.Status -eq 200) "Accepted attendance scan failed: $($scan.Body)"
  Assert-That (($scan.Body | ConvertFrom-Json).outcome -eq "accepted") "Valid device/card scan was not accepted"
  Assert-That ($scanReplay.Status -eq 200 -and ($scanReplay.Body | ConvertFrom-Json).scan_event_id -eq ($scan.Body | ConvertFrom-Json).scan_event_id) "Same idempotency key did not replay the stored scan"
  Assert-That (($duplicateScan.Body | ConvertFrom-Json).outcome -eq "duplicate") "Second same-day scan did not return duplicate"
  Assert-That (($rejectedScan.Body | ConvertFrom-Json).rejection_code -eq "unknown_card") "Unknown card rejection contract mismatch"
  Assert-That ($invalidDevice.Status -eq 401 -or $invalidDevice.Status -eq 403) "Invalid device credential was not rejected"
  $scanBodyObject = $scan.Body | ConvertFrom-Json
  Assert-That (-not ($scanBodyObject.PSObject.Properties.Name -contains "student_id")) "Attendance response exposed a student identifier"
  $scanRows = Invoke-LocalPsql "select 'attendance='||count(*) from public.attendance_records where school_id='$($ids.School)' and student_id='$($ids.StudentRecord)'; select 'scan_events='||count(*) from public.attendance_scan_events where school_id='$($ids.School)' and device_id='$deviceId';"
  Assert-That (($scanRows -join ",") -eq "attendance=1,scan_events=3") "Attendance row/scan event counts mismatch"
  Write-Output "process-attendance-scan: accepted mutation, same-key replay, same-day duplicate, unknown-card rejection and invalid device denial verified"
  Write-Output "local fixture school_id=$($ids.School); fixtures remain isolated in the local database"
}
finally {
  Stop-Function
  $http.Dispose()
  Set-Location $oldLocation
  Remove-Item -LiteralPath $ctxPath,$envPath -Force -ErrorAction SilentlyContinue
}
