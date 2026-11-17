const fs=require('node:fs'); const vm=require('node:vm'); const assert=require('node:assert/strict'); const {test}=require('node:test');
const targetPath = fs.existsSync(require('node:path').join(__dirname,'../src/services/payrollService.js'))
  ? require('node:path').join(__dirname,'../src/services/payrollService.js')
  : require('node:path').join(__dirname,'../backend/src/services/payrollService.js');
const src=fs.readFileSync(targetPath,'utf8');
const start=src.indexOf('function toUtcCalendarDate(');
const end=src.indexOf('function isValidPakistaniIban(');
const context=vm.createContext({Date,Math,Number,Array,Map,Set,Error,Object,prisma:{employee:{findMany:async()=>[]}}});
vm.runInContext(src.slice(start,end).replace('async function assertCurrentPayrollSnapshot','async function assertCurrentPayrollSnapshot')+ '\nthis.salaryForPayrollPeriod=salaryForPayrollPeriod;this.assertCurrentPayrollSnapshot=assertCurrentPayrollSnapshot;',context);
const dates=(date)=>new Date(`${date}T00:00:00Z`);
const emp=(code,basic,from,revision)=>({id:code,employeeCode:code,employmentStatus:'ACTIVE',joiningDate:dates('2026-01-01'),salaryStructures:[{effectiveFrom:dates(from),baseSalary:basic,houseRentAllowance:code==='EMP-001'?10000:5000,medicalAllowance:code==='EMP-001'?5000:0,conveyanceAllowance:code==='EMP-001'?3000:0,specialAllowance:code==='EMP-001'?2000:0}],salaryRevisions:revision?[{status:'APPROVED',effectiveDate:dates('2026-11-14'),previousBaseSalary:50000,proposedBaseSalary:57500}]:[]});
test('EMP-001 November increment prorated using fixed 31-day divisor',()=>{const sal=context.salaryForPayrollPeriod(emp('EMP-001',50000,'2026-11-01',true),'2026-11-01','2026-11-30');assert.equal(sal.baseSalary,54112.90);assert.equal(sal.houseRentAllowance+sal.medicalAllowance+sal.conveyanceAllowance+sal.specialAllowance,20000)});
test('EMP-001 December full basic 57,500 on approved revision',()=>{const sal=context.salaryForPayrollPeriod(emp('EMP-001',50000,'2026-11-01',true),'2026-12-01','2026-12-31');assert.equal(sal.baseSalary,57500)});
test('EMP-002 November retains 40,000',()=>{assert.equal(context.salaryForPayrollPeriod(emp('EMP-002',40000,'2026-11-01',false),'2026-11-01','2026-11-30').baseSalary,40000)});
test('revision unrelated to preceding month has no effect',()=>{assert.equal(context.salaryForPayrollPeriod(emp('EMP-001',50000,'2026-11-01',true),'2026-10-01','2026-10-31'),null)});
test('stale payroll rejects excluded EMP-002 and old EMP-001 salary',async()=>{const employees=[emp('EMP-001',50000,'2026-11-01',true),emp('EMP-002',40000,'2026-11-01',false)];context.prisma.employee.findMany=async()=>employees; const run={payrollPeriod:{startDate:dates('2026-11-01'),endDate:dates('2026-11-30')},entries:[{employeeId:'EMP-001',basicSalary:50000}]};await assert.rejects(context.assertCurrentPayrollSnapshot(run),e=>e.code==='STALE_PAYROLL_HEADCOUNT')});
test('stale payroll blocks old basic even with both employees present',async()=>{const employees=[emp('EMP-001',50000,'2026-11-01',true),emp('EMP-002',40000,'2026-11-01',false)];context.prisma.employee.findMany=async()=>employees; const run={payrollPeriod:{startDate:dates('2026-11-01'),endDate:dates('2026-11-30')},entries:[{employeeId:'EMP-001',basicSalary:50000,houseRentAllowance:10000,medicalAllowance:5000,conveyanceAllowance:3000,specialAllowance:2000},{employeeId:'EMP-002',basicSalary:40000,houseRentAllowance:5000}]};await assert.rejects(context.assertCurrentPayrollSnapshot(run),e=>e.code==='STALE_PAYROLL_SALARY')});
test('EMP-004 superseded snapshot 90,000 does not corrupt active basic 30,000',()=>{
  const emp4 = {
    id: 'EMP-004',
    employeeCode: 'EMP-004',
    employmentStatus: 'ACTIVE',
    joiningDate: dates('2026-01-01'),
    salaryStructures: [
      { effectiveFrom: dates('2026-11-16'), effectiveUntil: dates('2026-11-16'), isCurrent: false, baseSalary: 90000 },
      { effectiveFrom: dates('2026-11-16'), effectiveUntil: null, isCurrent: true, baseSalary: 30000 }
    ],
    salaryRevisions: []
  };
  const sal = context.salaryForPayrollPeriod(emp4, '2026-11-01', '2026-11-30');
  assert.equal(sal.baseSalary, 30000);
});
test('EMP-007 superseded snapshot 85,000 does not corrupt active basic 30,000',()=>{
  const emp7 = {
    id: 'EMP-007',
    employeeCode: 'EMP-007',
    employmentStatus: 'ACTIVE',
    joiningDate: dates('2026-01-01'),
    salaryStructures: [
      { effectiveFrom: dates('2026-11-16'), effectiveUntil: dates('2026-11-16'), isCurrent: false, baseSalary: 85000 },
      { effectiveFrom: dates('2026-11-16'), effectiveUntil: null, isCurrent: true, baseSalary: 30000 }
    ],
    salaryRevisions: []
  };
  const sal = context.salaryForPayrollPeriod(emp7, '2026-11-01', '2026-11-30');
  assert.equal(sal.baseSalary, 30000);
});
