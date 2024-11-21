import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import './TimesheetStyles.css';
import * as XLSX from "xlsx"; 


const TimesheetList = () => {
  const [employees, setEmployees] = useState([]);
  const [timesheetData, setTimesheetData] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [nextDay, setNextDay] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);
  const [totalTime, setTotalTime] = useState(0);
  const [nightShiftHours, setNightShiftHours] = useState(0);
  const [holidayTime, setHolidayTime] = useState(0);
  const [normalTime, setNormalTime] = useState(0);
  const [overTime, setOverTime] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // Start with current month
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear()); // Start with current year
  const [sortOrder, setSortOrder] = useState("asc"); // Initial sorting order: ascending
  const [sortBy, setSortBy] = useState("totalTime"); // Default sorting by total time
  const [expandedRows, setExpandedRows] = useState({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [groupFilter, setGroupFilter] = useState("all");

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);

  

  const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0"); // Month is zero-based
    return `${day}-${month}`;
  };


  const handleGroupFilter = (group) => {
    setGroupFilter(group);
  };

  const filteredEmployees = employees.filter(employee => {
    if (groupFilter === "all") {
      return true; 
    }
    return employee.group === groupFilter; 
  });
  
  
  const toggleAllRows = () => {
    setAllExpanded(!allExpanded);

    const updatedExpandedRows = {};
    employees.forEach(employee => {
      updatedExpandedRows[employee.id] = !allExpanded;
    });
    setExpandedRows(updatedExpandedRows);
  };

  const resetFileState = () => {
    setExcelFile(null);  // Reset the selected file state
    setExcelPreview([]); // Reset the preview state
  };

  const generateMonthDays = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(`${month + 1}-${day < 10 ? '0' + day : day}`);
    }
    return days;
  };

  const [today, setToday] = useState(() => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${month}-${day < 10 ? '0' + day : day}`;
});

  useEffect(() => {
    const fetchEmployees = () => {
      const unsubscribe = onSnapshot(collection(db, "employees"), (snapshot) => {
        const employeeData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEmployees(employeeData);
      });
      return unsubscribe;
    };

    const fetchTimesheetData = () => {
      const timesheetDataRef = collection(db, "timesheets");
      const unsubscribe = onSnapshot(timesheetDataRef, (snapshot) => {
        const updatedTimesheetData = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          const employeeId = doc.id;
          if (data.hours) {
            updatedTimesheetData[employeeId] = {};
            for (const [date, record] of Object.entries(data.hours)) {
              updatedTimesheetData[employeeId][date] = {
                startTime: record.startTime,
                endTime: record.endTime,
                totalTime: parseFloat(record.totalTime),
                nightShift: parseFloat(record.nightShift),
                holidayTime: parseFloat(record.holidayTime),
                overTime: parseFloat(record.overTime),
                isHoliday: Boolean(record.isHoliday),
                normalTime: record.normalTime != null && record.normalTime !== "" ? parseFloat(record.normalTime) : null,

              };
            }
          }
        });
        setTimesheetData(updatedTimesheetData);
      });
      return unsubscribe;
    };

    fetchEmployees();
    fetchTimesheetData();
  }, []);

  const handleSetTime = (employeeId, date) => {
    setSelectedEmployee(employeeId);
    setSelectedDate(date);
    setStartTime(timesheetData[employeeId]?.[date]?.startTime || "");
    setEndTime(timesheetData[employeeId]?.[date]?.endTime || "");
    setIsHoliday(timesheetData[employeeId]?.[date]?.isHoliday || false);
    setModalOpen(true);
  };

  const handleStartTimeChange = (event) => {
    const newStartTime = event.target.value;
    setStartTime(newStartTime);
    calculateTimes(newStartTime, endTime, nextDay, isHoliday);
  };

  const handleEndTimeChange = (event) => {
    const newEndTime = event.target.value;
    setEndTime(newEndTime);
    calculateTimes(startTime, newEndTime, nextDay, isHoliday);
  };

  const handleNextDayToggle = () => {
    const newNextDay = !nextDay;
    setNextDay(newNextDay);
    calculateTimes(startTime, endTime, newNextDay, isHoliday);
    console.log('nextday', nextDay);

  };

const handleHolidayToggle = () => {
  const newIsHoliday = !isHoliday;
  setIsHoliday(newIsHoliday);

  if (newIsHoliday) {
    setNormalTime(0);
    setOverTime(0);
    setNightShiftHours(0);
    setTotalTime(totalTime);
    setHolidayTime(totalTime);
  } else {
    calculateTimes(startTime, endTime, nextDay, newIsHoliday);
  }
};
  const calculateTimes = (start, end, isNextDay, isHoliday) => {
    if (!start || !end) return;

    const [startHours, startMinutes] = start.split(":").map(Number);
    const [endHours, endMinutes] = end.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(startHours, startMinutes, 0);
    const endDate = new Date();
    endDate.setHours(endHours, endMinutes, 0);
    if (isNextDay) endDate.setDate(endDate.getDate() + 1);

const totalTimeInHours = (endDate - startDate) / (1000 * 60 * 60);



let nightShiftHours = 0;
let normalHours = 0;

let startTime = startDate.getHours() + startDate.getMinutes() / 60;
let endTime = endDate.getHours() + endDate.getMinutes() / 60;



let totalTimeWorked = (endDate - startDate) / (1000 * 60 * 60); // Total hours worked

if (startTime >= 0 && startTime < 6) {
  if (nextDay === true && endTime >= 0 && endTime < 6) {
    nightShiftHours = endTime - startTime;
  }
  else if (nextDay === true && endTime >= 6 && endTime < 22) {
    nightShiftHours = 6 - startTime; 
    normalHours = endTime - 6;
  }
  else if (nextDay === true && endTime >= 22 && endTime < 24) {
    nightShiftHours = (6 - startTime) + (endTime - 22);
  }
  else if (nextDay === false && endTime >= 0 && endTime < 6) {
    nightShiftHours = (6 - startTime) + (endTime + 2); 
  }
  else if (nextDay === false && endTime >= 6 && endTime < 22) {
    nightShiftHours = 6 - startTime; 
    normalHours = endTime - 6;
  }
  else if (nextDay === false && endTime >= 22 && endTime < 24) {
    nightShiftHours = (6 - startTime) + (endTime - 22) + 8; 
  }
}

else if (startTime >= 6 && startTime < 22) {
  if (nextDay === true && endTime >= 6 && endTime < 22) {
    normalHours = endTime - startTime;
  }
  else if (nextDay === true && endTime >= 22 && endTime < 24) {
    nightShiftHours = endTime - 22;
  }
  else if (nextDay === false && endTime >= 0 && endTime < 6) {
    nightShiftHours = endTime + 2;
  }
  else if (nextDay === false && endTime >= 6 && endTime < 22) {
    nightShiftHours = 8;
  }
  else if (nextDay === false && endTime >= 22 && endTime < 24) {
    nightShiftHours = 8 + endTime - 22;
  }
}

else if (startTime >= 22 && startTime < 24) {
  if (nextDay === true && endTime >= 22 && endTime < 24) {
    nightShiftHours = endTime - startTime;
  }
  else if (nextDay === false && endTime >= 0 && endTime < 6) {
    nightShiftHours = endTime - startTime + 24;
  }
  else if (nextDay === false && endTime >= 6 && endTime < 22) {
    nightShiftHours = 30 - startTime;
  }
  else if (nextDay === false && endTime >= 22 && endTime < 24) {
    nightShiftHours = 8 + endTime - 22;
  }
}


    setTotalTime(totalTimeInHours.toFixed(1));
    setNightShiftHours(nightShiftHours.toFixed(1));

    const overTime = isHoliday ? 0 : (totalTimeInHours > 8 ? totalTimeInHours - 8 : 0);
    setOverTime(overTime.toFixed(1));

    const normalTime = isHoliday ? 0 : totalTimeInHours - nightShiftHours - overTime;
    setNormalTime(normalTime.toFixed(1));

    const holidayTime = isHoliday ? totalTimeInHours : 0;
    setHolidayTime(holidayTime.toFixed(1));
  };

  const saveTimesheetDataToFirebase = async () => {
    try {
      const timesheetDocRef = doc(db, "timesheets", selectedEmployee);
      const timesheetData = (await getDoc(timesheetDocRef)).data()?.hours || {};
      timesheetData[selectedDate] = {
        startTime,
        endTime,
        totalTime: parseFloat(totalTime),
        nightShift: parseFloat(nightShiftHours),
        holidayTime: parseFloat(holidayTime),
        overTime: parseFloat(overTime),
        normalTime: parseFloat(normalTime),
        isHoliday,
      };
      await setDoc(timesheetDocRef, { hours: timesheetData });
      setModalOpen(false);
    } catch (error) {
      console.error("Error saving timesheet data:", error);
    }
  };

  const calculateMonthlyTotal = (employeeId) => {
    let monthlyTotal = {
      normalTime: 0,
      nightShift: 0,
      holidayTime: 0,
      totalTime: 0,
    };

    const monthDays = generateMonthDays(currentYear, currentMonth);
    monthDays.forEach((date) => {
      const data = timesheetData[employeeId]?.[date];
      if (data) {
        monthlyTotal.normalTime += data.normalTime || 0;
        monthlyTotal.nightShift += data.nightShift || 0;
        monthlyTotal.holidayTime += data.holidayTime || 0;
        monthlyTotal.totalTime += data.totalTime || 0;
      }
    });

    return monthlyTotal;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth((prevMonth) => (prevMonth === 0 ? 11 : prevMonth - 1));
    if (currentMonth === 0) setCurrentYear(currentYear - 1);
  };

  const goToNextMonth = () => {
    setCurrentMonth((prevMonth) => (prevMonth === 11 ? 0 : prevMonth + 1));
    if (currentMonth === 11) setCurrentYear(currentYear + 1); 
  };



  const getColorForWorkedHours = (totalWorkedHours, expectedHours) => {
    const diff = totalWorkedHours - expectedHours; 
  
    if (diff >= -10 && diff <= 10) {
      const greenIntensity = Math.round(155 + (100 * (10 - Math.abs(diff)) / 10));
      return `rgb(0, ${greenIntensity}, 0)`;
    } else if (diff < -10) {
      const adjustedDiff = Math.min(Math.abs(diff) - 10, 50);
      const redIntensity = Math.round(100 + (155 * adjustedDiff / 50)); 
      return `rgb(${redIntensity}, 0, -1)`;
    } else {
      const adjustedDiff = Math.min(diff - 10, 40);
      const yellowIntensity = Math.round(155 + (100 * adjustedDiff / 40));
      return `rgb(${yellowIntensity}, ${yellowIntensity}, 0)`;
    }
  };

  const monthDays = generateMonthDays(currentYear, currentMonth);


  const handleSort = (column) => {
  const newSortOrder = sortBy === column && sortOrder === "asc" ? "desc" : "asc"; 
  setSortBy(column); 
  setSortOrder(newSortOrder); 

  const sortedEmployees = [...employees].sort((a, b) => {
    const totalA = calculateMonthlyTotal(a.id)[column];
    const totalB = calculateMonthlyTotal(b.id)[column];

    if (newSortOrder === "asc") {
      return totalA - totalB;
    } else {
      return totalB - totalA;
    }
  });
  setEmployees(sortedEmployees); 
};

const handleExcelChange = (e) => {
  const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
  if (file) {
    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0]; // Assume the first sheet
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Read sheet as an array of rows
      setExcelPreview(rows.slice(0, 5));  // Preview the first 5 rows
    };
    reader.readAsBinaryString(file);
  }
};


const convertRowDates = (row) => {
  return row.map(cell => {
    // Apply excelToDate to numbers that look like dates (Excel serial numbers)
    return !isNaN(cell) && cell > 0 ? excelToDate(cell) : cell;
  });
};


const exportToExcel = () => {
  // Prepare the data
  const rows = [];
  
  // Set up the header with formatted date
  const header = ["Name", "Shift", ...monthDays.map(date => formatDate(date)), "Total"];
  rows.push(header);

  filteredEmployees.forEach(employee => {
    const row = [
      employee.name,
      "Regular", // Adjust as per your data
      ...monthDays.map(date => {
        const data = timesheetData[employee.id]?.[date] || {};
        // Ensure the date is formatted as dd-mm and not a JavaScript Date object
        const formattedDate = formatDate(date); // Format date before using
        return data.normalTime ? data.normalTime.toFixed(1) : "";
      }),
      calculateMonthlyTotal(employee.id).normalTime.toFixed(1), // Example for total, update accordingly
    ];
    rows.push(row);
  });

  // Create the worksheet from the rows
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Create a new workbook and append the sheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

  // Export the file
  XLSX.writeFile(wb, "timesheet.xlsx");
};



const toggleRowExpansion = (employeeId) => {
  setExpandedRows((prevState) => ({
    ...prevState,
    [employeeId]: !prevState[employeeId], // Toggle the expansion state
  }));
};

// Refactored handleImportExcel function to accept a file
const handleImportExcel = async (file) => {
  if (!file) return; // Ensure a file is provided

  try {
    const data = await file.arrayBuffer(); // Read file data as an array buffer
    const workbook = XLSX.read(data, { type: "array" }); // Parse the workbook
    const sheetName = workbook.SheetNames[0]; // Assume the first sheet
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Convert to an array of arrays

    // Apply excelToDate to the header row (first row) only
    const headerRow = jsonData[0];
    headerRow.forEach((cell, colIndex) => {
      if (typeof cell === 'number') {
        // If the cell is a number (Excel serial date)
        headerRow[colIndex] = excelToDate(cell); // Convert the Excel serial date to "DD-MM"
      }
    });

    console.log("Processed Header Row:", headerRow);

    // Process data rows (starting from index 1)
    const dataRows = jsonData.slice(1); // Data rows without the header
    dataRows.forEach((row) => {
      // You can process each row as needed
      console.log("Processed Data Row:", row);
    });

    processExcelData(jsonData); // Assuming this function handles the final processing/upload

  } catch (error) {
    console.error("Error reading the Excel file:", error);
  }
};


const processExcelData = (data) => {
  if (data.length < 2) {
    alert("Invalid template structure. Please check the file.");
    return;
  }

  const [headers, ...rows] = data;

  // Validate headers (dates in the first row after "Employee Name")
  const dates = headers.slice(1); // Skip "Employee Name"
  if (!dates.every(date => !isNaN(Date.parse(date)))) {
    alert("Invalid date format in headers. Please ensure they are in YYYY-MM-DD format.");
    return;
  }

  // Process each row (employees)
  const updatedTimesheetData = {};
  rows.forEach(row => {
    const [employeeName, ...timeRanges] = row;
  
    if (!employeeName) return; // Skip empty rows
  
    timeRanges.forEach((timeRange, index) => {
      const date = dates[index]; // Extract date from headers
      if (!timeRange || !date) return; // Skip empty cells
    
      const [startTime, endTime] = timeRange.split("-").map(time => time.trim());
      if (!startTime || !endTime) {
        console.warn(`Invalid time range "${timeRange}" for ${employeeName} on ${date}`);
        return;
      }
    
      // Ensure date is stored as a string
      if (!updatedTimesheetData[employeeName]) {
        updatedTimesheetData[employeeName] = {};
      }
    
      updatedTimesheetData[employeeName][`${date}`] = {
        startTime,
        endTime,
        totalTime: calculateTotalTime(startTime, endTime),
      };
    });
    
  });
  

  // Update Firebase with parsed data
  updateTimesheetsInFirebase(updatedTimesheetData);
};

const calculateTotalTime = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const start = new Date();
  start.setHours(startHours, startMinutes, 0);

  const end = new Date();
  end.setHours(endHours, endMinutes, 0);

  if (end < start) {
    end.setDate(end.getDate() + 1); // Handle next day case
  }

  return ((end - start) / (1000 * 60 * 60)).toFixed(1); // Total hours worked
};

const updateTimesheetsInFirebase = async (timesheetData) => {
  try {
    for (const [employeeName, dates] of Object.entries(timesheetData)) {
      const employee = employees.find(emp => emp.name === employeeName);
      if (!employee) {
        console.warn(`Employee "${employeeName}" not found.`);
        continue;
      }

      const timesheetDocRef = doc(db, "timesheets", employee.id);
      const existingData = (await getDoc(timesheetDocRef)).data()?.hours || {};

      // Ensure merged data has string keys
      const updatedData = { ...existingData, ...dates };

      // Debugging: Check if all keys are strings
      const invalidKeys = Object.keys(updatedData).filter(key => typeof key !== "string");
      if (invalidKeys.length > 0) {
        console.error("Invalid non-string keys detected:", invalidKeys);
        alert("Error: Some date keys are not strings. Please check your data.");
        return;
      }

      console.log(`Updating Firebase for ${employeeName}:`, updatedData); // Debug log
      await setDoc(timesheetDocRef, { hours: updatedData });
    }

    alert("Timesheet data imported successfully!");
  } catch (error) {
    console.error("Error updating timesheets in Firebase:", error);
    alert("Failed to update timesheet data.");
  }
};


function excelToDate(excelDate) {
  let startDate = new Date(0); // January 1, 1970, Unix epoch
  startDate.setDate(startDate.getDate() + excelDate); // Add the days to the start date

  let day = startDate.getDate();
  let month = startDate.getMonth() + 1; // Months are 0-indexed

  // Format the date as "dd-mm"
  let formattedDate = `${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
  return formattedDate
}


return (
  <div>
    <div className="month-navigation" style={{ position: "relative" }}>
      <button onClick={goToPreviousMonth}>Previous Month</button>
      <span>{new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
      <button onClick={goToNextMonth}>Next Month</button>

      <button 
        onClick={exportToExcel}
        style={{
          padding: "10px",
          fontSize: "15px", 
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          cursor: "pointer",
          position: "absolute",
          right: "170px",  // Align to the right edge
          top: "0px"     // Position below the month navigation
        }}
      >
        Export to Excel
      </button>

      <button onClick={() => setImportModalOpen(true)}
      style={{
          padding: "10px",
          fontSize: "15px", 
          backgroundColor: "#f39c12",
          color: "white",
          border: "none",
          cursor: "pointer",
          position: "absolute",
          right: "10px",  // Align to the right edge
          top: "0px"     // Position below the month navigation
        }}
      >
        Import from Excel
        </button>
    </div>

    {/* Add the "Expand All / Collapse All" and Group Filter buttons */}
    <div style={{ marginBottom: "10px" }}>
    <button
  onClick={toggleAllRows}
  style={{
    padding: "10px",
    fontSize: "15px",
    backgroundColor: allExpanded ? "#4CAF50" : "#4CAF50",  // Red for collapse, green for expand
    color: "white",
    border: "none",
    cursor: "pointer"
  }}
>
  {allExpanded ? "Collapse All" : "Expand All"}
</button>

<button 
  onClick={() => handleGroupFilter("1")} 
  style={{ 
    padding: "10px", 
    fontSize: "15px", 
    width: "80px" // Set a fixed width for all buttons
  }}
>
  Group 1
</button>

<button 
  onClick={() => handleGroupFilter("2")} 
  style={{ 
    padding: "10px", 
    fontSize: "15px", 
    width: "80px" // Same width as the other button
  }}
>
  Group 2
</button>

<button 
  onClick={() => handleGroupFilter("all")} 
  style={{ 
    padding: "10px", 
    fontSize: "15px", 
    width: "80px" // Same width as the other buttons
  }}
>
  All   
</button>

    </div>

    <table border="1">
      <thead>
        <tr>
          <th>Name</th>
          <th>Shift</th>
          {monthDays.map((date, index) => {
            // Check if it's today's date
            const isToday = date === today;
            return (
              <th
                key={date}
                className={isToday ? "highlight-today" : ""}
              >
                {parseInt(date.split('-')[1], 10)}
              </th>
            );
          })}
          <th
            onClick={() => handleSort("totalTime")} // Call the sort handler on click
            style={{ cursor: "pointer" }}
          >
            Monthly Total {sortBy === "totalTime" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
          </th>
        </tr>
      </thead>
      <tbody>
        {filteredEmployees.map((employee, employeeIndex) => {
          const monthlyTotal = calculateMonthlyTotal(employee.id);

          // Filter the monthDays to get only the days up until today
          const filteredDays = monthDays.filter(date => new Date(date) <= new Date(today));

          // Calculate the number of weekdays (excluding weekends) up until today
          const expectedWeekdays = filteredDays.filter(date => {
            const day = new Date(date).getDay(); // Get the day of the week (0 = Sunday, 6 = Saturday)
            return day !== 0 && day !== 6; // Only weekdays (exclude weekends)
          }).length;

          // Calculate the total expected hours up until today (expected weekdays * 8 hours per day)
          const totalExpectedHours = expectedWeekdays * 8;

          // Calculate the total worked hours up until today
          const totalWorkedHours = filteredDays.reduce((acc, date) => {
            const employeeData = timesheetData[employee.id]?.[date] || {};
            return acc + (employeeData.normalTime || 0) + (employeeData.nightShift || 0) + (employeeData.holidayTime || 0);
          }, 0);

          // Get the color for the Total row based on the worked hours vs expected hours
          const totalRowColor = getColorForWorkedHours(totalWorkedHours, totalExpectedHours);

          const isExpanded = expandedRows[employee.id]; // Check if the row is expanded

          return (
            <React.Fragment key={employee.id}>
              {/* Main row for employee with the name cell to toggle expansion */}
              <tr
                className={`row ${employeeIndex % 2 === 0 ? "odd-row" : "even-row"}`}
                style={{ backgroundColor: "lightgreen" }} // Regular shift row color
              >
                <td
                  rowSpan={isExpanded ? 5 : 1}
                  onClick={() => toggleRowExpansion(employee.id)} // Click on the name to toggle expansion
                  style={{ cursor: "pointer", fontWeight: "bold" }}
                >
                  {employee.name}
                </td>

                {/* Conditionally render Total row if collapsed */}
                {!isExpanded ? (
                  <>
                    <td>Total</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.totalTime != null
                        ? `${timesheetData[employee.id][date].totalTime.toFixed(1)}`
                        : ""}

                      </td>
                    ))}
                    <td style={{ backgroundColor: totalRowColor }}>{monthlyTotal.totalTime.toFixed(1)}</td>
                  </>
                ) : (
                  <>
                    {/* Show Regular Row when Expanded */}
                    <td>Regular</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.normalTime != null
                        ? `${timesheetData[employee.id][date].normalTime.toFixed(1)}`
                        : ""}
                      </td>
                    ))}
                    <td>{monthlyTotal.normalTime.toFixed(1)}</td>
                  </>
                )}
              </tr>

              {/* Display expanded rows if expanded */}
              {isExpanded && (
                <>

                
                  {/* Night Shift Row */}
                  <tr
                    className={`row ${employeeIndex % 2 === 0 ? "odd-row" : "even-row"}`}
                    style={{ backgroundColor: "lightblue" }} // Night shift row color
                  >
                    <td>Night</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.nightShift === 0
                          ? "0"
                          : timesheetData[employee.id]?.[date]?.nightShift
                          ? `${timesheetData[employee.id][date].nightShift.toFixed(1)}`
                          : ""}
                      </td>
                    ))}
                    <td>{monthlyTotal.nightShift.toFixed(1)}</td>
                  </tr>

                  {/* Over Time Row */}
                  <tr
                    className={`row ${employeeIndex % 2 === 0 ? "odd-row" : "even-row"}`}
                    style={{ backgroundColor: "lightblue" }} // Night shift row color
                  >
                    <td>Over</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.overTime === 0
                          ? "0"
                          : timesheetData[employee.id]?.[date]?.overTime
                          ? `${timesheetData[employee.id][date].overTime.toFixed(1)}`
                          : ""}
                      </td>
                    ))}
                    <td>{monthlyTotal.nightShift.toFixed(1)}</td>
                  </tr>

                  {/* Holiday Row */}
                  <tr
                    className={`row ${employeeIndex % 2 === 0 ? "odd-row" : "even-row"}`}
                    style={{ backgroundColor: "lightcoral" }} // Holiday row color
                  >
                    <td>Holiday</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.holidayTime === 0
                          ? "0"
                          : timesheetData[employee.id]?.[date]?.holidayTime
                          ? `${timesheetData[employee.id][date].holidayTime.toFixed(1)}`
                          : ""}
                      </td>
                    ))}
                    <td>{monthlyTotal.holidayTime.toFixed(1)}</td>
                  </tr>


                  {/* Total Row */}
                  <tr
                    style={{
                      backgroundColor: totalRowColor, // Apply the color to the entire Total row
                    }}
                  >
                    <td>Total</td>
                    {monthDays.map((date) => (
                      <td
                        key={date}
                        onClick={() => handleSetTime(employee.id, date)}
                        className={date === today ? "highlight-today" : ""}
                      >
                        {timesheetData[employee.id]?.[date]?.totalTime === 0
                          ? "0"
                          : timesheetData[employee.id]?.[date]?.totalTime
                          ? `${timesheetData[employee.id][date].totalTime.toFixed(1)}`
                          : ""}
                      </td>
                    ))}
                    <td>{monthlyTotal.totalTime.toFixed(1)}</td>
                  </tr>
                </>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>

{/* Import Modal */}
{importModalOpen && (
  <div className="modal2">
    <div className="modal-content2">
      <h2>Import Employees</h2>

      {/* Drag-and-Drop File Upload Box */}
      <div
        className="file-upload-box2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) {
            // Handle file change and preview
            handleExcelChange({ target: { files: [file] } });
          }
        }}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          id="file-input2"
          onChange={handleExcelChange} // Handles file preview
          className="file-input2-hidden"
        />
        <label htmlFor="file-input2" className="file-input2-label">
          Drag and drop or click to choose
        </label>
        <div className="file-name2">{excelFile ? excelFile.name : "No file selected"}</div>
      </div>

      {/* File Preview */}
      {excelPreview.length > 0 && (
        <div className="preview-container2">
          <h3>Preview (first few rows)</h3>
          <table className="preview-table2">
            <thead>
              <tr>
                {convertRowDates(excelPreview[0]).map((cell, index) => (
                  <th key={index}>{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {excelPreview.slice(1, 6).map((row, index) => (  // Preview first 5 data rows
                <tr key={index}>
                  {convertRowDates(row).map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Button Row for Submit and Close Buttons */}
      <div className="button-row2">
        <button
          className="import-btn2"
          onClick={() => {
            // Handle import and then close the modal
            handleImportExcel(excelFile);  // Import the file
            resetFileState();  // Reset the file state
            setImportModalOpen(false);  // Close the modal
          }}
        >
          Submit
        </button>
        <button
          className="close-btn2"
          onClick={() => {
            // Reset and close the modal without submitting
            resetFileState();  // Reset the state
            setImportModalOpen(false);  // Close the modal
          }}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}





    {modalOpen && (
      <div className="modal1">
        <div className="modal-content1">
          <h2 className="modal-heading1">Timesheet Details</h2>
          
          <div className="form-container1">
            <label className="form-label1">
              Start Time:
              <input
                type="text"
                value={startTime}
                onChange={handleStartTimeChange}
                className="input-field1"
                placeholder="hh:mm"
              />
            </label>
            
            <label className="form-label1">
              End Time:
              <input
                type="text"
                value={endTime}
                onChange={handleEndTimeChange}
                className="input-field1"
                placeholder="hh:mm"
              />
            </label>

            <div className="checkbox-container1">
              <label className="checkbox-label1">
                <span>Next Day:</span>
                <input
                  type="checkbox"
                  checked={nextDay}
                  onChange={handleNextDayToggle}
                  className="checkbox-input1"
                />
              </label>

              <label className="checkbox-label1">
                <span>Is Holiday:</span>
                <input
                  type="checkbox"
                  checked={isHoliday}
                  onChange={handleHolidayToggle}
                  className="checkbox-input1"
                />
              </label>
            </div>
            
            <div className="time-summary1">
              <p>Total Time: {totalTime} hours</p>
              <p>Night Shift Hours: {nightShiftHours} hours</p>
              <p>Normal Time: {normalTime} hours</p>
              <p>Over Time: {overTime} hours</p>
              <p>Holiday Time: {holidayTime} hours</p>
            </div>
            
            <div className="modal-actions1">
              <button onClick={saveTimesheetDataToFirebase} className="save-btn1">Save</button>
              <button className="close-btn1" onClick={() => setModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

};

export default TimesheetList;
