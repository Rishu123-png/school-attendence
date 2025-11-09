let step = 0;
let student = {};
let verifiedStudent = null;
let chat = document.getElementById("chat-window");

function botMessage(text) {
  chat.innerHTML += `<div class="message bot">${text}</div>`;
  chat.scrollTop = chat.scrollHeight;
}

function userMessage(text) {
  chat.innerHTML += `<div class="message user">${text}</div>`;
  chat.scrollTop = chat.scrollHeight;
}

function handleKey(event) {
  if (event.key === "Enter") sendMessage();
}

function sendMessage() {
  const input = document.getElementById("userMessage");
  const text = input.value.trim();
  if (!text) return;

  userMessage(text);
  input.value = "";

  setTimeout(() => botReply(text), 500);
}

function botReply(msg) {
  msg = msg.trim();

  if (step === 0) {
    botMessage("👋 Hi! Please tell me your full name to verify your record.");
    step++;
  } 
  else if (step === 1) {
    student.name = msg;
    verifiedStudent = studentsData.find(s => s.name.toLowerCase() === msg.toLowerCase());

    if (!verifiedStudent) {
      botMessage("⚠️ Sorry, your name is not found in the school database. Please try again or contact your teacher.");
      step = 0;
      return;
    }

    botMessage(`Welcome ${verifiedStudent.name}! You are registered in class ${verifiedStudent.class} for ${verifiedStudent.subject}.`);
    botMessage(`Please confirm your class name to continue.`);
    step++;
  } 
  else if (step === 2) {
    student.class = msg.toUpperCase();

    if (student.class !== verifiedStudent.class) {
      botMessage(`❌ Wrong class! You are registered in ${verifiedStudent.class}.`);
      step = 0;
      return;
    }

    botMessage(`✅ Verified class ${student.class}. Now confirm your subject.`);
    step++;
  } 
  else if (step === 3) {
    student.subject = msg;

    if (student.subject.toLowerCase() !== verifiedStudent.subject.toLowerCase()) {
      botMessage(`❌ Wrong subject! You are enrolled in ${verifiedStudent.subject}.`);
      step = 0;
      return;
    }

    botMessage(`All details matched. Are you present today? (yes / no)`);
    step++;
  } 
  else if (step === 4) {
    if (msg.toLowerCase() === "yes") {
      student.status = "Present";
    } else {
      student.status = "Absent";
    }

    let data = JSON.parse(localStorage.getItem("studentAttendance")) || [];
    data.push({
      name: verifiedStudent.name,
      class: verifiedStudent.class,
      subject: verifiedStudent.subject,
      status: student.status,
      time: new Date().toLocaleTimeString()
    });
    localStorage.setItem("studentAttendance", JSON.stringify(data));

    botMessage(`✅ Attendance marked as "${student.status}" for ${verifiedStudent.subject} (${verifiedStudent.class}).`);
    botMessage("Thank you! 👋");

    // Reset flow
    step = 0;
  }
}

// Start chatbot
window.onload = () => {
  botMessage("🤖 Welcome to Smart Attendance Chatbot!");
  botMessage("Please type anything to begin.");
};
