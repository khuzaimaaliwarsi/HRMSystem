import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import hrLettersService from '../services/hrLettersService.js';

// Actor profiles
const superAdminActor = { name: 'Tariq Mehmood', role: 'super_admin', employeeId: 'EMP-001', department: 'Executive' };
const hrAdminActor = { name: 'Ayesha Khan', role: 'hr_admin', employeeId: 'EMP-002', department: 'HR' };
const managerActor = { name: 'Bilal Ahmed', role: 'manager', employeeId: 'EMP-003', department: 'Engineering' };
const employeeActor = { name: 'Zeeshan Ali', role: 'employee', employeeId: 'EMP-004', department: 'Engineering' };
const otherEmployeeActor = { name: 'Hina Farooq', role: 'employee', employeeId: 'EMP-005', department: 'Finance' };

beforeEach(() => {
  hrLettersService.resetToDefaults();
});

test('1. Template Creation & Editing with Version History', () => {
  // Create template
  const newTemplate = hrLettersService.saveTemplate({
    letterType: 'General / Custom HR Letter',
    templateName: 'Department Transfer Letter 2026',
    subject: 'Internal Department Transfer — {{employee_name}}',
    body: 'Dear {{employee_name}}, this confirms your transfer to {{department}} department effective {{effective_date}}.',
    authorizedSignatory: 'Ayesha Khan',
    signatoryTitle: 'Head of Human Resources',
    status: 'Active'
  }, hrAdminActor);

  assert.ok(newTemplate.templateId.startsWith('TMP-'));
  assert.equal(newTemplate.version, '1.0');
  assert.equal(newTemplate.status, 'Active');

  // Edit template -> increments version
  const updated = hrLettersService.saveTemplate({
    templateId: newTemplate.templateId,
    letterType: 'General / Custom HR Letter',
    templateName: 'Department Transfer Letter 2026 (Revised)',
    subject: 'Official Notice of Internal Transfer — {{employee_name}}',
    body: 'Dear {{employee_name}}, we hereby confirm your transfer to {{department}}.',
    status: 'Active'
  }, hrAdminActor);

  assert.equal(updated.version, '1.1');
  assert.equal(updated.templateName, 'Department Transfer Letter 2026 (Revised)');
});

test('2. Dynamic Placeholder Replacement: Correctly interpolates canonical employee data', () => {
  const templateBody = 'Dear {{employee_name}} ({{employee_id}}), welcome to {{department}} as {{designation}}. You report to {{reporting_manager}} at {{company_name}}.';
  const dummyEmp = {
    name: 'Zeeshan Ali',
    employeeId: 'EMP-004',
    designation: 'Senior Frontend Engineer',
    department: 'Engineering',
    reportingManager: 'Bilal Ahmed'
  };

  const interpolated = hrLettersService.interpolatePlaceholders(templateBody, dummyEmp, {}, hrAdminActor);
  assert.ok(interpolated.includes('Dear Zeeshan Ali (EMP-004)'));
  assert.ok(interpolated.includes('welcome to Engineering as Senior Frontend Engineer'));
  assert.ok(interpolated.includes('report to Bilal Ahmed'));
  assert.ok(interpolated.includes('iSysware Software Solutions (Pvt) Ltd'));
});

test('3. Missing-Field Validation: Fails if required template fields are missing', () => {
  assert.throws(() => {
    hrLettersService.saveTemplate({
      letterType: '',
      templateName: 'Incomplete Template',
      subject: 'Subject',
      body: 'Body'
    }, hrAdminActor);
  }, /letter type is required/i);

  assert.throws(() => {
    hrLettersService.saveTemplate({
      letterType: 'Offer Letter',
      templateName: '',
      subject: 'Subject',
      body: 'Body'
    }, hrAdminActor);
  }, /template title\/name is required/i);
});

test('4. Salary Protection: Unprivileged actors cannot prepare protected salary revision letters', () => {
  const templates = hrLettersService.getTemplates();
  const salaryTmpl = templates.find((t) => t.letterType === 'Salary Increment Letter');

  // Manager attempts to generate protected salary letter
  assert.throws(() => {
    hrLettersService.createLetterDraft({
      templateId: salaryTmpl.templateId,
      employeeId: employeeActor.employeeId,
      letterType: 'Salary Increment Letter'
    }, managerActor);
  }, /access denied.*protected salary/i);
});

test('5. Confidential Salary Shielding: Placeholder engine hides salary from non-HR callers', () => {
  const salaryTemplate = 'Basic salary: {{basic_salary}}, Gross: {{gross_salary}}';
  const dummyEmp = {
    name: 'Zeeshan Ali',
    basicSalary: 120000,
    grossSalary: 160000
  };

  // Called by standard employee/manager -> replaced with CONFIDENTIAL
  const shielded = hrLettersService.interpolatePlaceholders(salaryTemplate, dummyEmp, {}, employeeActor);
  assert.ok(shielded.includes('CONFIDENTIAL'));
  assert.ok(!shielded.includes('120,000'));

  // Called by HR Admin -> interpolates actual amounts
  const unshielded = hrLettersService.interpolatePlaceholders(salaryTemplate, dummyEmp, {}, hrAdminActor);
  assert.ok(unshielded.includes('120,000'));
  assert.ok(unshielded.includes('160,000'));
});

test('6. Letter Draft Generation & Initial Status', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Employment Confirmation Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  assert.ok(draft.letterId.startsWith('LTR-'));
  assert.equal(draft.status, 'Draft');
  assert.equal(draft.approvalStatus, 'Draft');
  assert.equal(draft.employeeId, employeeActor.employeeId);
  assert.ok(draft.contentSnapshot.length > 20);
});

test('7. Multi-tier Approval Routing: Draft -> Pending Approval -> Approved', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Employment Confirmation Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  // Submit
  const submitted = hrLettersService.submitForApproval(draft.letterId, hrAdminActor);
  assert.equal(submitted.status, 'Pending Approval');

  // Super Admin approves
  const approved = hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Executive Signoff');
  assert.equal(approved.approvalStatus, 'Approved');
});

test('8. Strict Anti-Self-Approval: Issuer/preparer cannot approve their own letter', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Employment Confirmation Letter');

  // hrAdmin prepares the letter
  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  hrLettersService.submitForApproval(draft.letterId, hrAdminActor);

  // hrAdmin attempts to approve own prepared letter -> throws Anti-Self-Approval
  assert.throws(() => {
    hrLettersService.approveLetter(draft.letterId, hrAdminActor, 'Self Approval');
  }, /anti-self-approval/i);
});

test('9. Sensitive Salary Letter Requires Super Admin Executive Approval', () => {
  const templates = hrLettersService.getTemplates();
  const salaryTmpl = templates.find((t) => t.letterType === 'Salary Increment Letter');

  // HR admin prepares salary revision letter
  const draft = hrLettersService.createLetterDraft({
    templateId: salaryTmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: salaryTmpl.letterType,
    customValues: { revisedSalary: 200000, incrementAmount: 40000 }
  }, hrAdminActor);

  hrLettersService.submitForApproval(draft.letterId, hrAdminActor);

  // Another HR Admin attempts to approve -> throws (requires Super Admin)
  const anotherHr = { name: 'Asim Raza', role: 'hr_admin', employeeId: 'EMP-007' };
  assert.throws(() => {
    hrLettersService.approveLetter(draft.letterId, anotherHr, 'HR Signoff');
  }, /require super admin/i);

  // Super Admin approves successfully
  const approved = hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Super Admin Signoff');
  assert.equal(approved.approvalStatus, 'Approved');
});

test('10. Immutable Letter Issuance & Reference Number Generation (ISW-LTR-YYYY-NNNNN)', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Experience Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  hrLettersService.submitForApproval(draft.letterId, hrAdminActor);
  hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Approved');

  // Issue final letter
  const issued = hrLettersService.issueLetter(draft.letterId, hrAdminActor);

  assert.equal(issued.status, 'Issued');
  assert.ok(issued.referenceNumber);
  assert.ok(issued.referenceNumber.startsWith('ISW-LTR-2026-'));
  assert.ok(issued.contentSnapshot.includes('Zeeshan Ali'));
});

test('11. Issued Content Immutability: Subsequent edits to template DO NOT alter issued letter', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Experience Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  hrLettersService.submitForApproval(draft.letterId, hrAdminActor);
  hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Approved');
  const issued = hrLettersService.issueLetter(draft.letterId, hrAdminActor);
  const frozenSnapshot = issued.contentSnapshot;

  // Now maliciously or accidentally update template body
  hrLettersService.saveTemplate({
    templateId: tmpl.templateId,
    letterType: tmpl.letterType,
    templateName: tmpl.templateName,
    subject: 'RADICAL OVERWRITE SUBJECT',
    body: 'RADICAL OVERWRITE: All previous letters are cancelled!'
  }, hrAdminActor);

  // Verify issued letter still contains its original immutable frozen snapshot
  const retrievedLetter = hrLettersService.getLetterById(issued.letterId, superAdminActor);
  assert.equal(retrievedLetter.contentSnapshot, frozenSnapshot);
  assert.ok(!retrievedLetter.contentSnapshot.includes('RADICAL OVERWRITE'));
});

test('12. Duplicate Issuance Prevention: Cannot issue already issued letter twice', () => {
  const letters = hrLettersService.getLetters();
  const alreadyIssued = letters.find((l) => l.status === 'Issued');

  assert.throws(() => {
    hrLettersService.issueLetter(alreadyIssued.letterId, hrAdminActor);
  }, /duplicate issuance prevented/i);
});

test('13. Unique Reference Number Guarantee across Multiple Issuances', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Employment Verification Letter');

  // Letter 1
  const draft1 = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);
  hrLettersService.submitForApproval(draft1.letterId, hrAdminActor);
  hrLettersService.approveLetter(draft1.letterId, superAdminActor, 'Approved');
  const issued1 = hrLettersService.issueLetter(draft1.letterId, hrAdminActor);

  // Letter 2
  const draft2 = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: otherEmployeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);
  hrLettersService.submitForApproval(draft2.letterId, hrAdminActor);
  hrLettersService.approveLetter(draft2.letterId, superAdminActor, 'Approved');
  const issued2 = hrLettersService.issueLetter(draft2.letterId, hrAdminActor);

  assert.notEqual(issued1.referenceNumber, issued2.referenceNumber);
});

test('14. Role-Based Confidentiality: Employee sees ONLY their personal issued letters', () => {
  // Employee logs in
  const empLetters = hrLettersService.getLetters({}, employeeActor);
  for (const l of empLetters) {
    assert.equal(l.employeeId, employeeActor.employeeId);
    assert.equal(l.status, 'Issued'); // Cannot view unissued drafts
  }

  // Super Admin sees all company letters including drafts
  const allLetters = hrLettersService.getLetters({}, superAdminActor);
  assert.ok(allLetters.length > empLetters.length);
});

test('15. Complete Audit Trail Preservation across Letter Lifecycle', () => {
  const templates = hrLettersService.getTemplates();
  const tmpl = templates.find((t) => t.letterType === 'Warning Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: tmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: tmpl.letterType
  }, hrAdminActor);

  assert.equal(draft.auditTrail.length, 1);
  assert.equal(draft.auditTrail[0].action, 'Drafted');

  hrLettersService.submitForApproval(draft.letterId, hrAdminActor);
  const submitted = hrLettersService.getLetterById(draft.letterId, superAdminActor);
  assert.equal(submitted.auditTrail.length, 2);

  hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Executive Signoff');
  const approved = hrLettersService.getLetterById(draft.letterId, superAdminActor);
  assert.equal(approved.auditTrail.length, 3);

  hrLettersService.issueLetter(draft.letterId, hrAdminActor);
  const issued = hrLettersService.getLetterById(draft.letterId, superAdminActor);
  assert.equal(issued.auditTrail.length, 4);
  assert.equal(issued.auditTrail[3].action, 'Officially Issued');
});

test('16. Super Admin Universal Authority: Can self-approve own prepared salary & non-salary letters', () => {
  const templates = hrLettersService.getTemplates();
  const salaryTmpl = templates.find((t) => t.letterType === 'Salary Increment Letter');

  const draft = hrLettersService.createLetterDraft({
    templateId: salaryTmpl.templateId,
    employeeId: employeeActor.employeeId,
    letterType: salaryTmpl.letterType,
    customValues: { revisedSalary: 225000, incrementAmount: 45000 }
  }, superAdminActor);

  hrLettersService.submitForApproval(draft.letterId, superAdminActor);
  const approved = hrLettersService.approveLetter(draft.letterId, superAdminActor, 'Super Admin direct authority');
  assert.equal(approved.approvalStatus, 'Approved');

  const issued = hrLettersService.issueLetter(draft.letterId, superAdminActor);
  assert.equal(issued.status, 'Issued');
  assert.ok(issued.referenceNumber.startsWith('ISW-LTR-'));
});

test('17. Async PostgreSQL Synchronization Helpers populate templates, letters, and auditLogs cleanly', () => {
  hrLettersService._upsertLocalTemplate({
    templateId: 'TMP-999',
    letterType: 'General / Custom HR Letter',
    templateName: 'QA Persisted Template',
    subject: 'QA Subject',
    body: 'QA Body {{employee_name}}',
    status: 'Active',
    version: '1.0'
  });
  const tList = hrLettersService.getTemplates();
  assert.ok(tList.some((t) => t.templateId === 'TMP-999'));

  hrLettersService._upsertLocalLetter({
    letterId: 'LTR-2026-9999',
    referenceNumber: 'ISW-LTR-2026-09999',
    employeeId: employeeActor.employeeId,
    employeeName: employeeActor.name,
    letterType: 'Employment Verification Letter',
    subject: 'QA Verification',
    contentSnapshot: 'Verified Snapshot',
    status: 'Issued',
    approvalStatus: 'Approved'
  });
  const found = hrLettersService.getLetterById('LTR-2026-9999', superAdminActor);
  assert.equal(found.referenceNumber, 'ISW-LTR-2026-09999');
});

test('18. TMP-001 signatory update bumps version 1.2 -> 1.3 and clear gateway error handling works on 502', async () => {
  const before = hrLettersService.getTemplateById('TMP-001');
  assert.ok(before);
  assert.equal(before.version, '1.2');

  const updated = hrLettersService.saveTemplate(
    {
      ...before,
      templateId: 'TMP-001',
      authorizedSignatory: 'Khuzaima Senior Developer'
    },
    superAdminActor
  );
  assert.equal(updated.authorizedSignatory, 'Khuzaima Senior Developer');
  assert.equal(updated.version, '1.3');

  const apiClient = (await import('../services/apiClient.js')).default;
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response('Bad Gateway', {
        status: 502,
        statusText: 'Bad Gateway',
        headers: { 'content-type': 'text/plain' }
      });

    await assert.rejects(
      () =>
        apiClient.patch('/letters/templates/TMP-001', {
          authorizedSignatory: 'Khuzaima Senior Developer'
        }),
      (err) => {
        assert.equal(err.status, 502);
        assert.equal(err.code, 'BAD_GATEWAY');
        assert.match(err.message, /backend API server.*restarting/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('19. First-load & SyncState: Cold empty cache loads ISW-LTR-2026-00001 cleanly on first refresh', async () => {
  // Simulate cold browser refresh with empty memory cache
  hrLettersService.memoryStorage['isysware_hrms_f11_letters_v1'] = [];
  hrLettersService.memoryStorage['isysware_hrms_f11_templates_v1'] = [];
  hrLettersService._syncState = { isLoading: false, hasLoadedOnce: false, error: null, lastLoadedAt: null };

  const issuedRow = {
    letterId: 'LTR-2026-0001',
    referenceNumber: 'ISW-LTR-2026-00001',
    employeeId: 'EMP-001',
    employeeCuid: 'cmw6xxjfu0001u804pra5o2tv',
    employeeName: 'Khuzaima Senior Developer',
    letterType: 'Employment Confirmation Letter',
    subject: 'Confirmation',
    contentSnapshot: 'Confirmed',
    status: 'Issued',
    approvalStatus: 'Approved'
  };

  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/letters/templates')) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (String(url).includes('/letters/audit-logs')) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: true, data: [issuedRow] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const res = await hrLettersService.loadLettersDataAsync();
    assert.equal(res.letters.length, 1);
    assert.equal(res.letters[0].referenceNumber, 'ISW-LTR-2026-00001');
    const state = hrLettersService.getSyncState();
    assert.equal(state.isLoading, false);
    assert.equal(state.hasLoadedOnce, true);
    assert.equal(state.error, null);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('20. Slow API & Sequence Guard: In-flight loading state stays true and slow older response never overwrites newer load', async () => {
  hrLettersService.memoryStorage['isysware_hrms_f11_letters_v1'] = [];
  hrLettersService._syncState = { isLoading: false, hasLoadedOnce: false, error: null, lastLoadedAt: null };

  let resolveSlowLetters;
  let lettersCallCount = 0;
  const origFetch = globalThis.fetch;

  try {
    globalThis.fetch = (url) => {
      if (String(url).includes('/letters/templates') || String(url).includes('/letters/audit-logs')) {
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      lettersCallCount += 1;
      if (lettersCallCount === 1) {
        return new Promise((resolve) => {
          resolveSlowLetters = () =>
            resolve(
              new Response(
                JSON.stringify({
                  success: true,
                  data: [{ letterId: 'STALE', referenceNumber: 'STALE-000', employeeId: 'EMP-001', status: 'Issued' }]
                }),
                { status: 200, headers: { 'content-type': 'application/json' } }
              )
            );
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [{ letterId: 'FRESH', referenceNumber: 'ISW-LTR-2026-00001', employeeId: 'EMP-001', status: 'Issued' }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
    };

    const slowPromise = hrLettersService.loadLettersDataAsync();
    assert.equal(hrLettersService.getSyncState().isLoading, true);

    // Forced retry finishes faster with newer PostgreSQL data
    await hrLettersService.loadLettersDataAsync({ force: true });
    assert.equal(hrLettersService.getLetters({}, superAdminActor)[0].referenceNumber, 'ISW-LTR-2026-00001');

    // Old slow response finally arrives -> MUST be ignored by sequence guard
    resolveSlowLetters();
    await slowPromise;
    assert.equal(hrLettersService.getLetters({}, superAdminActor).length, 1);
    assert.equal(hrLettersService.getLetters({}, superAdminActor)[0].referenceNumber, 'ISW-LTR-2026-00001');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('21. Failed API: Sets clear error state without wiping previously loaded letters and recovers on retry', async () => {
  hrLettersService.memoryStorage['isysware_hrms_f11_letters_v1'] = [
    { letterId: 'LTR-1', referenceNumber: 'ISW-LTR-2026-00001', employeeId: 'EMP-001', status: 'Issued' }
  ];
  hrLettersService._syncState = { isLoading: false, hasLoadedOnce: true, error: null, lastLoadedAt: Date.now() };

  const origFetch = globalThis.fetch;
  let shouldFail = true;

  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('/letters/templates') || String(url).includes('/letters/audit-logs')) {
        return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      if (shouldFail) {
        return new Response(JSON.stringify({ error: { message: 'Database temporarily unavailable' } }), {
          status: 500,
          headers: { 'content-type': 'application/json' }
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          data: [{ letterId: 'LTR-1', referenceNumber: 'ISW-LTR-2026-00001', employeeId: 'EMP-001', status: 'Issued' }]
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    };

    await assert.rejects(() => hrLettersService.loadLettersDataAsync({ force: true }), /Database temporarily unavailable/);
    assert.equal(hrLettersService.getSyncState().error, 'Database temporarily unavailable');
    assert.equal(hrLettersService.getSyncState().isLoading, false);
    // Previously loaded PostgreSQL record is NOT wiped to 0!
    assert.equal(hrLettersService.getLetters({}, superAdminActor).length, 1);

    // Retry succeeds cleanly
    shouldFail = false;
    await hrLettersService.loadLettersDataAsync({ force: true });
    assert.equal(hrLettersService.getSyncState().error, null);
    assert.equal(hrLettersService.getLetters({}, superAdminActor).length, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('22. Concurrent Sync & backendSync Guard: Coalesces simultaneous loads and never wipes PostgreSQL letters when /employees fails', async () => {
  const { syncHrLetters, syncAllModules } = await import('../services/backendSync.js');
  const { employeeService } = await import('../services/employeeService.js');

  hrLettersService.memoryStorage['isysware_hrms_f11_letters_v1'] = [];
  hrLettersService._syncState = { isLoading: false, hasLoadedOnce: false, error: null, lastLoadedAt: null };
  employeeService.memoryStorage['isysware_hrms_f02_employees_v1'] = [];

  let lettersGetCalls = 0;
  const origFetch = globalThis.fetch;
  const origWindow = globalThis.window;

  try {
    globalThis.window = { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
    globalThis.fetch = async (url) => {
      const s = String(url);
      if (s.endsWith('/letters') || s.includes('/letters?')) {
        lettersGetCalls += 1;
        await new Promise((r) => setTimeout(r, 25));
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ letterId: 'LTR-CONC', referenceNumber: 'ISW-LTR-2026-00001', employeeId: 'EMP-001', status: 'Issued' }]
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (s.includes('/employees')) {
        // Simulate transient failure in unrelated /employees endpoint
        return new Response('Internal Server Error', { status: 500, headers: { 'content-type': 'text/plain' } });
      }
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    // Trigger page mount load + backendSync.syncHrLetters simultaneously
    await Promise.all([hrLettersService.loadLettersDataAsync(), syncHrLetters()]);
    assert.equal(lettersGetCalls, 1, 'Concurrent non-forced loads must coalesce into 1 network call');
    assert.equal(hrLettersService.getLetters({}, superAdminActor).length, 1);

    // Run full syncAllModules even while /employees returns 500 -> letters MUST NOT be wiped to 0!
    await syncAllModules();
    assert.equal(hrLettersService.getLetters({}, superAdminActor).length, 1);
    assert.equal(hrLettersService.getLetters({}, superAdminActor)[0].referenceNumber, 'ISW-LTR-2026-00001');
  } finally {
    globalThis.fetch = origFetch;
    globalThis.window = origWindow;
  }
});
