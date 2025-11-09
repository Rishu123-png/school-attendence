// students.js

// Example student data (you can add more later)
const studentsData = {
  "11A": {
    "AI": ["Rishu Jaswar", "Amit Singh", "Niharika Sharma"],
    "CS": ["Priya Sharma", "Vivek Raj"],
    "Psychology": ["Ananya Gupta", "Rohan Kumar"]
  },
  "11B": {
    "AI": ["Kartik Verma", "Mehul Jain"],
    "Data Science": ["Sakshi Gupta", "Tanya Mehta"],
    "PED": ["Aarav Mishra", "Aditi Patel"]
  }
};

// Function to get students by class and subject
function getStudents(selectedClass, selectedSubject) {
  if (studentsData[selectedClass] && studentsData[selectedClass][selectedSubject]) {
    return studentsData[selectedClass][selectedSubject];
  } else {
    return [];
  }
}

export { getStudents };
