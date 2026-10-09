CREATE TABLE "PlatformMembership" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "role" "MembershipRole" NOT NULL DEFAULT 'PLATFORM_ADMIN',
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformMembership_user_id_key" ON "PlatformMembership"("user_id");
ALTER TABLE "PlatformMembership" ADD CONSTRAINT "PlatformMembership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;