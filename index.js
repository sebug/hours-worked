const fs = require('fs');

const template = getTemplate();
const startDate = getStartDate(template);
const allDates = Array.from(datesUntilNow(template, startDate));

for (let d of allDates) {
    console.log(d);
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

function addWeek(sd) {
    let nextWeek = new Date(dateFromStructured(sd));
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
    throw new Error('No period found for date ' + JSON.stringify(sd));
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
