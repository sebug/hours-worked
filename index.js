const fs = require('fs');

const template = getTemplate();
const holidays = getHolidays();
const startDate = getStartDate(template);
const allDates = Array.from(datesUntilNow(template, startDate));
const holidayFilter = createHolidayFilter(holidays);
const datesExcludingHolidays = allDates.filter(holidayFilter);
const mentionHours = createMentionHours(template);
const datesWithHours = datesExcludingHolidays.map(mentionHours);
const groupedByMonth = Array.from(groupByMonth(datesWithHours));
const mentionSalary = createMentionSalary(getSalary());
const groupedByMonthWithSalary = groupedByMonth.map(mentionSalary);

for (let d of groupedByMonthWithSalary) {
    console.log(formatLine(d));
}

/**
 * A structured date
 * @typedef {{ year: Number, month: Number, day: Number}} StructuredDate
 */
/**
 * A date together with hours worked
 * @typedef {{ date: StructuredDate, hoursWorked: Number }} DateWithHours
 */
/**
 * A month group of hours worked
 * @typedef {{ year: Number, month: Number, hoursWorked: Number, concernedDates: Array<StructuredDate> }} MonthHoursWorkedGroup
 */

/**
 * A salary group, containing information about a month worked, with charges excluded salary as well
 * @typedef {{ year: Number, month: Number, hoursWorked: Number, monthlySalaryChargesExcluded: Number}} SalaryGroup
 */


/**
 * Formats a line of salary group (for inclusion in e-mails, excel, ...)
 * @param {SalaryGroup} salaryGroup the group to format
 * @returns {String} the formatted line
 */
function formatLine(salaryGroup) {
    const year = '' + salaryGroup.year;
    let month = '' + salaryGroup.month;
    if (month.length === 1) {
	month = '0' + month;
    }
    const monthString = year + '.' + month;
    return monthString + '\t' + salaryGroup.hoursWorked + '\t' + salaryGroup.monthlySalaryChargesExcluded;
}

/**
 * Groups dates with hours entries by month
 * @param {Array<DateWithHours>} datesWithHours
 * @returns {IterableIterator<MonthHoursWorkedGroup>} the months with hours worked
 */
function* groupByMonth(datesWithHours) {
    if (!datesWithHours || !datesWithHours.length) {
	return;
    }
    let currentMonth = {
	year: datesWithHours[0].date.year,
	month: datesWithHours[0].date.month,
	hoursWorked: 0,
	concernedDates: []
    };
    // assumes the dates are ordered
    for (let dateWithHours of datesWithHours) {
	if (dateWithHours.date.year === currentMonth.year &&
	    dateWithHours.date.month === currentMonth.month) {
	    currentMonth.hoursWorked += dateWithHours.hoursWorked;
	    currentMonth.concernedDates.push(dateWithHours.date);
	} else {
	    yield currentMonth;
	    currentMonth = {
		year: dateWithHours.date.year,
		month: dateWithHours.date.month,
		hoursWorked: dateWithHours.hoursWorked,
		concernedDates: [ dateWithHours.date ]
	    };
	}
    }
    yield currentMonth;
}

/**
 * Creates a function that augments a MonthHoursWorkedGroup with the monthly salary
 * @param {Array<SalaryPeriod>} salary the salary periods
 * @returns {(monthGroup: MonthHoursWorkedGroup) => SalaryGroup} the function that augments a month group with the salary
 */
function createMentionSalary(salary) {
    return function (monthGroup) {
	const sd = {
	    year: monthGroup.year,
	    month: monthGroup.month,
	    day: 1
	};
	const salaryPeriod = getMatchingPeriod(salary, sd);
	return {
	    year: monthGroup.year,
	    month: monthGroup.month,
	    hoursWorked: monthGroup.hoursWorked,
	    monthlySalaryChargesExcluded: monthGroup.hoursWorked * salaryPeriod.salaryPerHour
	};
    };
}

function createMentionHours(template) {
    return function (sd) {
	const correspondingPeriod = getMatchingPeriod(template, sd);
	if (!correspondingPeriod) {
	    throw new Error("Expected to have found a corresponding period for " + JSON.stringify(sd));
	}
	return {
	    date: sd,
	    hoursWorked: correspondingPeriod.hoursPerWeek
	};
    };
}


function* datesUntilNow(template, startDate) {
    let d = startDate;
    while (dateFromStructured(d) <= new Date()) {
	yield d;

	const currentPeriod = getMatchingPeriod(template, d);
	const nextWeek = addWeek(d);
	const nextPeriod = getMatchingPeriod(template, nextWeek);
	if (currentPeriod === nextPeriod) {
	    d = nextWeek;
	} else {
	    // moved to another period, take its start date
	    d = nextPeriod.from;
	}
    }
}

function createHolidayFilter(holidays) {
    return function (sd) {
	const p = getMatchingPeriod(holidays, sd);
	return !p; // true if not on holiday, false otherwise
    };
}

function addWeek(sd) {
    let nextWeek = dateFromStructured(sd);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return structuredFromDate(nextWeek);
}

function getMatchingPeriod(template, sd) {
    for (let period of template) {
	if (valueOfStructured(period.from) <= valueOfStructured(sd)) {
	    if (!period.to) {
		// Open-ended period to the future
		return period;
	    }
	    if (valueOfStructured(sd) <= valueOfStructured(period.to)) {
		return period;
	    }
	}
    }
}

function advanceToWeekDay(date, weekDay) {
    if (date.getDay() === weekDay) {
	return date;
    }
    let tomorrow = new Date(date.valueOf());
    tomorrow.setDate(tomorrow.getDate() + 1);
    return advanceToWeekDay(tomorrow, weekDay);
}

function valueOfStructured(sd) {
    return sd.year * 10000 + sd.month * 100 + sd.day;
}

// the global idea is to use JS dates as little as possible,
// so we use the structured format { year, month, day }
function structuredFromDate(d) {
    return {
	year: d.getFullYear(),
	month: d.getMonth() + 1,
	day: d.getDate()
    };
}

function dateFromStructured(d) {
    return new Date(d.year, d.month - 1, d.day);
}

function getStartDate(template) {
    const fromDates = template.map(t => advanceToWeekDay(dateFromStructured(t.from), t.weekDay)).map(structuredFromDate);
    let min = fromDates[0];
    for (let date of fromDates) {
	if (valueOfStructured(date) < valueOfStructured(min)) {
	    min = date;
	}
    }
    return min;
}

function getTemplate() {
    const content = fs.readFileSync('template.json','utf-8');
    return JSON.parse(content);
}

function getHolidays() {
    const content = fs.readFileSync('holidays.json','utf-8');
    return JSON.parse(content);
}

/**
 * A salary period
 * @typedef {{ from: StructuredDate, to: StructuredDate?, salaryPerHour: Number }} SalaryPeriod
 */

/**
 * Returns the salary periods
 * @returns {Array<SalaryPeriod>} the array of salary periods
 */
function getSalary() {
    const content = fs.readFileSync('salary.json','utf-8');
    return JSON.parse(content);
}
