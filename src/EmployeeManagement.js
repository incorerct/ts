import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "./firebaseConfig"; // Import the Firestore db instance
import * as XLSX from "xlsx"; // Import the xlsx library

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    phone: "",
    sap: "",
    group: "", // Add group field
  });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // For Excel import
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreview, setExcelPreview] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "employees"));
        const employeeData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEmployees(employeeData);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    fetchEmployees();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      if (!newEmployee.name || !newEmployee.phone || !newEmployee.sap || !newEmployee.group) {
        alert("Please fill all fields!");
        return;
      }
      const docRef = await addDoc(collection(db, "employees"), newEmployee);
      setEmployees((prev) => [...prev, { id: docRef.id, ...newEmployee }]);
      setNewEmployee({ name: "", phone: "", sap: "", group: "" });
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error adding employee:", error);
    }
  };

  const handleDoubleClick = (employee, field) => {
    setEditingEmployee({ ...employee, fieldToEdit: field });
  };

  const handleUpdateEmployee = async () => {
    try {
      if (!editingEmployee) return;

      const employeeDoc = doc(db, "employees", editingEmployee.id);
      await updateDoc(employeeDoc, {
        name: editingEmployee.name,
        phone: editingEmployee.phone,
        sap: editingEmployee.sap,
        group: editingEmployee.group,
      });

      setEmployees((prev) =>
        prev.map((emp) => (emp.id === editingEmployee.id ? editingEmployee : emp))
      );
      setEditingEmployee(null);
    } catch (error) {
      console.error("Error updating employee:", error);
    }
  };

  const handleDeleteEmployee = async (employeeId) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this employee?");
    if (isConfirmed) {
      try {
        const employeeDoc = doc(db, "employees", employeeId);
        await deleteDoc(employeeDoc);
        setEmployees((prev) => prev.filter((emp) => emp.id !== employeeId));
      } catch (error) {
        console.error("Error deleting employee:", error);
      }
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredEmployees = employees.filter((employee) => {
    return (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.phone.includes(searchTerm) ||
      employee.sap.toString().includes(searchTerm) ||
      employee.group.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });

    const sortedEmployees = [...filteredEmployees].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });

    setEmployees(sortedEmployees);
  };

  // Function to export employee data to Excel
  const exportToExcel = () => {
    const filteredData = employees.map(({ name, phone, sap, group }) => ({
      Group: group,
      Name: name,
      Phone: phone,
      SAP: sap,
    }));

    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    XLSX.writeFile(workbook, "Employees.xlsx");
  };

// Handle Excel file selection and preview
const handleExcelChange = (e) => {
  const file = e.target.files[0];
  if (file) {
    setExcelFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0]; // Assuming first sheet
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // Convert sheet to array
      setExcelPreview(rows.slice(1, 6)); // Skip the first row (headers) and limit to 5 rows for preview
    };
    reader.readAsBinaryString(file);
  }
};


  // Handle importing the Excel data to Firestore
  const handleImportToFirestore = async () => {
    if (!excelFile) return;

    try {
      const rows = excelPreview;
      const employeesToImport = rows.slice(0).map(row => ({
        group: row[0],
        name: row[1],
        phone: row[2],
        sap: row[3],
      }));

      for (let emp of employeesToImport) {
        await addDoc(collection(db, "employees"), emp);
      }

      setEmployees((prev) => [...prev, ...employeesToImport]);
      setImportModalOpen(false);
      setExcelFile(null);
      setExcelPreview([]);
    } catch (error) {
      console.error("Error importing data:", error);
    }
  };

  // Handle "Enter" key press to save updates
  const handleKeyDown = (e, field) => {
    if (e.key === "Enter") {
      handleUpdateEmployee();
    }
  };

  return (
    <div className="employee-management">
      <div className="header">
        <input
          type="search"
          placeholder="Search Employees..."
          value={searchTerm}
          onChange={handleSearchChange}
        />

        <div className="button-container">
          <button className="add-employee-btn" onClick={() => setIsModalOpen(true)}>
            Add New Employee
          </button>

          <button className="export-btn" onClick={exportToExcel}>
            Export to Excel
          </button>

          {/* Import Excel Button */}
          <button className="import-btn" onClick={() => setImportModalOpen(true)}>
            Import from Excel
          </button>
        </div>
      </div>

      <h3>Employee List</h3>
      <table className="employee-table" border="1">
        <thead>
          <tr>
            <th onClick={() => handleSort("group")}>Group</th>
            <th onClick={() => handleSort("name")}>Name</th>
            <th onClick={() => handleSort("phone")}>Phone</th>
            <th onClick={() => handleSort("sap")}>SAP</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.map((employee) => (
            <tr key={employee.id}>
              <td onDoubleClick={() => handleDoubleClick(employee, "group")}>
                {editingEmployee && editingEmployee.id === employee.id && editingEmployee.fieldToEdit === "group" ? (
                  <input
                    type="text"
                    name="group"
                    value={editingEmployee.group}
                    onChange={(e) =>
                      setEditingEmployee((prev) => ({ ...prev, group: e.target.value }))
                    }
                    onBlur={handleUpdateEmployee}
                    onKeyDown={(e) => handleKeyDown(e, "group")}
                  />
                ) : (
                  employee.group
                )}
              </td>
              <td onDoubleClick={() => handleDoubleClick(employee, "name")}>
                {editingEmployee && editingEmployee.id === employee.id && editingEmployee.fieldToEdit === "name" ? (
                  <input
                    type="text"
                    name="name"
                    value={editingEmployee.name}
                    onChange={(e) =>
                      setEditingEmployee((prev) => ({ ...prev, name: e.target.value }))
                    }
                    onBlur={handleUpdateEmployee}
                    onKeyDown={(e) => handleKeyDown(e, "name")}
                  />
                ) : (
                  employee.name
                )}
              </td>
              <td onDoubleClick={() => handleDoubleClick(employee, "phone")}>
                {editingEmployee && editingEmployee.id === employee.id && editingEmployee.fieldToEdit === "phone" ? (
                  <input
                    type="text"
                    name="phone"
                    value={editingEmployee.phone}
                    onChange={(e) =>
                      setEditingEmployee((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    onBlur={handleUpdateEmployee}
                    onKeyDown={(e) => handleKeyDown(e, "phone")}
                  />
                ) : (
                  employee.phone
                )}
              </td>
              <td onDoubleClick={() => handleDoubleClick(employee, "sap")}>
                {editingEmployee && editingEmployee.id === employee.id && editingEmployee.fieldToEdit === "sap" ? (
                  <input
                    type="text"
                    name="sap"
                    value={editingEmployee.sap}
                    onChange={(e) =>
                      setEditingEmployee((prev) => ({ ...prev, sap: e.target.value }))
                    }
                    onBlur={handleUpdateEmployee}
                    onKeyDown={(e) => handleKeyDown(e, "sap")}
                  />
                ) : (
                  employee.sap
                )}
              </td>
              <td className="actions">
                {editingEmployee && editingEmployee.id === employee.id ? (
                  <button onClick={handleUpdateEmployee}>Save</button>
                ) : (
                  <button onClick={() => handleDoubleClick(employee, "name")}>Edit</button>
                )}
                <button onClick={() => handleDeleteEmployee(employee.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for importing Excel */}
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
            handleExcelChange({ target: { files: [file] } });
          }
        }}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          id="file-input2"
          onChange={handleExcelChange}
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
                <th>Group</th>
                <th>Name</th>
                <th>Phone</th>
                <th>SAP</th>
              </tr>
            </thead>
            <tbody>
              {excelPreview.map((row, index) => (
                <tr key={index}>
                  <td>{row[0]}</td>
                  <td>{row[1]}</td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Button Row for Import and Close Buttons */}
      <div className="button-row2">
        <button className="import-btn2" onClick={handleImportToFirestore}>
          Import
        </button>
        <button className="close-btn2" onClick={() => setImportModalOpen(false)}>
          Close
        </button>
      </div>
    </div>
  </div>
)}


{isModalOpen && (
  <div className="modalq">
    <div className="modal-contentq">
      <h2>Add New Employee</h2>
      <form onSubmit={handleAddEmployee}>
        <label>Group</label>
        <input
          type="text"
          name="group"
          value={newEmployee.group}
          onChange={handleInputChange}
          className="inputq"
        />
        <label>Name</label>
        <input
          type="text"
          name="name"
          value={newEmployee.name}
          onChange={handleInputChange}
          className="inputq"
        />
        <label>Phone</label>
        <input
          type="text"
          name="phone"
          value={newEmployee.phone}
          onChange={handleInputChange}
          className="inputq"
        />
        <label>SAP</label>
        <input
          type="text"
          name="sap"
          value={newEmployee.sap}
          onChange={handleInputChange}
          className="inputq"
        />
        <div className="button-containerq">
  <button type="submit" className="submit-btnq">Add</button>
  <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btnq">Cancel</button>
</div>
      </form>
    </div>
  </div>
)}

    </div>
  );
};

export default EmployeeManagement;
