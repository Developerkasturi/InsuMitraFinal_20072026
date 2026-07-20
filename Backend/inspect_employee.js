const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMPLOYEE_PROFILE_ID = '6a3b9b8339a4e6c9def2d386';

async function main() {
  // 1. Find the EmployeeProfile and its linked userId
  const profile = await prisma.employeeProfile.findUnique({
    where: { id: EMPLOYEE_PROFILE_ID },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!profile) {
    console.log('❌ No EmployeeProfile found for ID:', EMPLOYEE_PROFILE_ID);
    return;
  }

  console.log('\n=== EmployeeProfile ===');
  console.log('  profileId: ', profile.id);
  console.log('  userId:    ', profile.userId);
  console.log('  firstName: ', profile.firstName);
  console.log('  lastName:  ', profile.lastName);
  console.log('  user.email:', profile.user?.email);
  console.log('  user.role: ', profile.user?.role);
  console.log('  user.id:   ', profile.user?.id);

  const userId = profile.userId;
  if (!userId) {
    console.log('❌ This EmployeeProfile has no linked userId — cannot have any daily logs');
    return;
  }

  // 2. All daily logs for this user (any date)
  const allLogs = await prisma.employeeDailyLog.findMany({
    where: { userId: userId },
    orderBy: { logDate: 'desc' },
  });

  console.log('\n=== All employee_daily_logs for userId:', userId, '===');
  if (allLogs.length === 0) {
    console.log('  ⚠️  ZERO records — this employee has never clocked in / no logs exist');
  } else {
    allLogs.forEach((log, i) => {
      console.log(`  [${i + 1}]`, {
        id:       log.id,
        logDate:  log.logDate,
        checkIn:  log.checkIn,
        checkOut: log.checkOut,
        userId:   log.userId,
      });
    });
  }

  // 3. Today's log specifically
  const nowUtc = new Date();
  const todayStr = nowUtc.toISOString().slice(0, 10);
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');
  const todayEnd   = new Date(todayStr + 'T23:59:59.999Z');

  console.log('\n=== Today\'s date (UTC):', todayStr, '===');
  console.log('    todayStart:', todayStart.toISOString());
  console.log('    todayEnd:  ', todayEnd.toISOString());

  const todayLog = await prisma.employeeDailyLog.findFirst({
    where: {
      userId: userId,
      logDate: { gte: todayStart, lte: todayEnd },
    },
  });

  if (todayLog) {
    console.log('  ✅ TODAY log found:', JSON.stringify(todayLog, null, 2));
  } else {
    console.log('  ❌ No log for today — employee correctly appears Absent');
  }

  // 4. Simulate getEmployees query for this employee
  const empWithLogs = await prisma.employeeProfile.findUnique({
    where: { id: EMPLOYEE_PROFILE_ID },
    include: {
      user: {
        include: {
          dailyLogs: {
            where: { logDate: { gte: todayStart, lte: todayEnd } },
          },
        },
      },
    },
  });

  console.log('\n=== getEmployees-style query result ===');
  console.log('  dailyLogs for today count:', empWithLogs?.user?.dailyLogs?.length ?? 0);
  const todayAttendance = (empWithLogs?.user?.dailyLogs?.length ?? 0) > 0 ? 'Present' : 'Absent';
  console.log('  → todayAttendance:', todayAttendance);

  // 5. All employees with TODAY logs (to find someone who IS Present)
  console.log('\n=== All employees with TODAY logs (Present employees) ===');
  const presentLogs = await prisma.employeeDailyLog.findMany({
    where: { logDate: { gte: todayStart, lte: todayEnd } },
    select: {
      id: true,
      logDate: true,
      checkIn: true,
      checkOut: true,
      userId: true,
      user: {
        select: { id: true, email: true, role: true },
      },
    },
  });

  if (presentLogs.length === 0) {
    console.log('  ⚠️  No one has a log for today — all employees will appear Absent');
  } else {
    presentLogs.forEach((log, i) => {
      console.log(`  [${i + 1}]`, {
        logId:     log.id,
        logDate:   log.logDate,
        checkIn:   log.checkIn,
        userId:    log.userId,
        userEmail: log.user?.email,
      });
    });
  }

  // 6. Total log count in the entire table
  const totalLogs = await prisma.employeeDailyLog.count();
  console.log('\n=== Total records in employee_daily_logs table:', totalLogs, '===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
