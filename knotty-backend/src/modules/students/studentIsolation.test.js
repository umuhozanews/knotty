const test = require('node:test');
const assert = require('node:assert/strict');

// Mock request / response helpers
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('Student isolation: getOne rejects reading another student profile', async () => {
  const ctrl = require('./controller');
  const service = require('./service');

  // Stub service.getStudentById
  const origGet = service.getStudentById;
  service.getStudentById = async (id, schoolId) => ({
    id: 'student-victim',
    user_id: 'user-victim',
    school_id: schoolId,
    first_name: 'Victim',
  });

  try {
    const req = {
      user: { id: 'user-attacker', role: 'STUDENT', school_id: 'school-1' },
      params: { id: 'student-victim' },
    };
    const res = createMockRes();

    await ctrl.getOne(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Access denied: You can only view your own profile/);
  } finally {
    service.getStudentById = origGet;
  }
});

test('Student isolation: getOne permits student reading their own profile', async () => {
  const ctrl = require('./controller');
  const service = require('./service');

  const origGet = service.getStudentById;
  service.getStudentById = async (id, schoolId) => ({
    id: 'student-self',
    user_id: 'user-self',
    school_id: schoolId,
    first_name: 'Self',
  });

  try {
    const req = {
      user: { id: 'user-self', role: 'STUDENT', school_id: 'school-1' },
      params: { id: 'student-self' },
    };
    const res = createMockRes();

    await ctrl.getOne(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, 'student-self');
  } finally {
    service.getStudentById = origGet;
  }
});

test('Student isolation: academics listExamResults filters to only own student results', async () => {
  const academicsCtrl = require('../academics/controller');
  const academicsService = require('../academics/service');

  const origList = academicsService.listExamResults;
  academicsService.listExamResults = async () => [
    { id: 'res-1', score: 95, student: { user_id: 'user-self', parent_id: 'parent-1' } },
    { id: 'res-2', score: 40, student: { user_id: 'user-other', parent_id: 'parent-2' } },
    { id: 'res-3', score: 75, student: { user_id: 'user-other-2', parent_id: 'parent-3' } },
  ];

  try {
    const req = {
      user: { id: 'user-self', role: 'STUDENT', school_id: 'school-1' },
      params: { examId: 'exam-1' },
    };
    const res = createMockRes();

    await academicsCtrl.listExamResults(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].id, 'res-1');
  } finally {
    academicsService.listExamResults = origList;
  }
});
