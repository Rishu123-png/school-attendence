// students.js (older version)

// Student lists for each class
export const studentsData = {
  "11A": [
    "Amit Sharma",
    "Rohan Mehta",
    "Priya Singh",
    "Neha Verma",
    "Arjun Patel"
  ],
  "11B": [
    "Sahil Kumar",
    "Mehul Gupta",
    "Ritika Yadav",
    "Simran Kaur",
    "Vivek Chauhan"
  ],
  "12A": [
    "Dhruv Sharma",
    "Isha Rawat",
    "Kabir Chauhan",
    "Tanya Bansal",
    "Manoj Gupta"
  ],
  "12B": [
    "Harsh Raj",
    "Aarav Khanna",
    "Sanya Jain",
    "Karan Singh",
    "Ananya Kapoor"
  ]
};

// Class list
export const classList = ["11A", "11B", "12A", "12B"];

// Subjects list
export const subjectList = [
  "Physics",
  "Chemistry",
  "Maths",
  "English",
  "Biology",
  "Computer Science",
  "AI",
  "Data Science"
];

// Function to load students of selected class
export function getStudentsByClass(className) {
  return studentsData[className] || [];
}