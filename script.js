// Firebase configuration is loaded from config.js

// Initialize Firebase
firebase.initializeApp(window.firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// Global variables
let tasks = [];
let notifDismissed = false;

// Show/hide app based on auth state
auth.onAuthStateChanged(function(user) {
  if (user && user.email === "imanuragkrverma@gmail.com") {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = '';
    loadTasksFromDatabase();
  } else {
    document.getElementById('loginContainer').style.display = '';
    document.getElementById('appContainer').style.display = 'none';
  }
});

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.onsubmit = function(e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      auth.signInWithEmailAndPassword(email, password)
        .then(() => {
          document.getElementById('loginError').textContent = '';
        })
        .catch(err => {
          document.getElementById('loginError').textContent = err.message;
        });
    };
  }
});

// Logout function
function logout() {
  auth.signOut();
}

// Load tasks from Realtime Database at start
async function loadTasksFromDatabase() {
  try {
    console.log("Attempting to load tasks from database...");
    const snapshot = await database.ref('journals/userTasks').once('value');
    console.log("Database snapshot:", snapshot.val());
    if (snapshot.exists()) {
      tasks = snapshot.val().tasks || [];
    } else {
      tasks = [];
    }
    console.log("Loaded tasks:", tasks);
    renderTasks();
    checkNotifications();
  } catch (error) {
    console.error("Error loading tasks from Realtime Database:", error);
    tasks = [];
    renderTasks();
  }
}

// Save tasks to Realtime Database
async function saveTasksToDatabase(tasksArray) {
  try {
    console.log("Attempting to save tasks:", tasksArray);
    console.log("Current user:", auth.currentUser);
    console.log("Database reference:", database.ref('journals/userTasks'));
    
    const result = await database.ref('journals/userTasks').set({ tasks: tasksArray });
    console.log("Save result:", result);
    console.log("Tasks saved to Realtime Database successfully");
  } catch (error) {
    console.error("Error saving tasks to Realtime Database:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
  }
}

// Replace local save/load functions with Realtime Database versions
function saveTasks(ts) {
  console.log("🔥 FIREBASE saveTasks function called with:", ts);
  saveTasksToDatabase(ts);
}

function loadTasks() {
  // This function is now async; provide a dummy fallback for sync calls before data load
  return tasks;
}

// Entry point functions
function startTaskEntry() {
  stepDateInput();
}

function stepDateInput() {
  modalRemove();
  let modal = createModal('Select date', `
    <input id="dateInput" placeholder="Pick a date" />
    <div class="modal-btn-group">
      <button class="btn" id="nextBtn" disabled>Next</button>
    </div>
  `);
  document.body.appendChild(modal);

  flatpickr("#dateInput", {
    dateFormat: "Y-m-d",
    onChange: function(selectedDates, dateStr) {
      document.getElementById('nextBtn').disabled = !dateStr;
    },
    allowInput: true
  });

  document.getElementById('nextBtn').onclick = () => {
    let date = document.getElementById("dateInput").value;
    if (date) stepTypeInput(date);
  };
}

function stepTypeInput(date) {
  modalRemove();
  let modal = createModal('Task Type?', `
    <select id="typeSelect">
      <option value="accomplished">Accomplished</option>
      <option value="future">Future</option>
    </select>
    <div class="modal-btn-group"><button class="btn" id="typeNextBtn">Next</button></div>
  `);
  document.body.appendChild(modal);
  document.getElementById("typeNextBtn").onclick = () => {
    let type = document.getElementById("typeSelect").value;
    modalRemove();
    stepCategoryInput(date, type);
  };
}

function stepCategoryInput(date, type) {
  modalRemove();
  let modal = createModal('Select Category', `
    <select id="categorySelect">
      <option value="Tech">Tech</option>
      <option value="Core">Core</option>
      <option value="Other">Other</option>
    </select>
    <div class="modal-btn-group"><button class="btn" id="catNextBtn">Next</button></div>
  `);
  document.body.appendChild(modal);
  document.getElementById("catNextBtn").onclick = () => {
    let cat = document.getElementById("categorySelect").value;
    modalRemove();
    if (type === "future") stepDeadlineInput(date, type, cat);
    else stepTaskInput(date, type, cat, null, []);
  };
}

function stepDeadlineInput(date, type, cat) {
  modalRemove();
  let modal = createModal('Set Deadline for Future Task', `
    <input id="deadlineInput" placeholder="Pick date & time" />
    <div class="modal-btn-group">
      <button class="btn" id="deadNextBtn" disabled>Next</button>
    </div>
  `);
  document.body.appendChild(modal);

  flatpickr("#deadlineInput", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    onChange: function(selectedDates, dateStr) {
      document.getElementById("deadNextBtn").disabled = !dateStr;
    },
    allowInput: true
  });

  document.getElementById("deadNextBtn").onclick = () => {
    let deadline = document.getElementById("deadlineInput").value;
    if (deadline) {
      modalRemove();
      stepTaskInput(date, type, cat, deadline, []);
    }
  };
}

function stepTaskInput(date, type, cat, deadline, newTasksArr) {
  modalRemove();
  let day = tasks.find(t => t.date === date);
  let prev = (day && day.sections[cat]) ? [...day.sections[cat]] : [];
  let combinedTasks = [...prev, ...newTasksArr];
  let modal = createModal(
    `Add to ${cat} [${type === "future" ? ("Future, deadline: " + (deadline || day?.deadline || "")) : "Accomplished"}]`,
    `
    <textarea id="taskText" placeholder="Type a task, press Add."></textarea>
    <div class="task-list">${combinedTasks.map((t, i) => `<div>${i + 1}. ${t}</div>`).join("")}</div>
    <div class="modal-btn-group">
      <button class="btn" id="addTaskBtn">Add Task</button>
      <button class="btn" id="doneTaskBtn">Done</button>
    </div>
    `
  );
  document.body.appendChild(modal);

  document.getElementById("addTaskBtn").onclick = () => {
    let txt = document.getElementById("taskText").value.trim();
    if (txt) {
      combinedTasks.push(txt);
      document.getElementById("taskText").value = "";
      document.querySelector(".task-list").innerHTML = combinedTasks.map((t, i) => `<div>${i + 1}. ${t}</div>`).join("");
    }
  };
  document.getElementById("doneTaskBtn").onclick = () => {
    if (combinedTasks.length > 0) {
      saveTaskEntry(date, type, cat, deadline, combinedTasks);
      modalRemove();
      selectOtherSection(date, type, deadline, getDaySections(date));
    }
  };
}

function getDaySections(date) {
  let day = tasks.find(t => t.date === date);
  return day ? { ...day.sections } : {};
}

function selectOtherSection(date, type, deadline, gathered) {
  let otherCats = ["Tech", "Core", "Other"].filter(c => !gathered[c]);
  if (otherCats.length === 0) { return; }
  let modal = createModal('Do you want to add tasks for another section?', `
    <select id="otherCatSelect">
      <option value="">No, done</option>
      ${otherCats.map(cat => `<option value="${cat}">${cat}</option>`).join("")}
    </select>
    <div class="modal-btn-group"><button class="btn" id="otherCatNextBtn">Next</button></div>
  `);
  document.body.appendChild(modal);
  document.getElementById("otherCatNextBtn").onclick = () => {
    let sel = document.getElementById("otherCatSelect").value;
    modalRemove();
    if (sel) {
      if (type === "future") stepTaskInput(date, type, sel, deadline, []);
      else stepTaskInput(date, type, sel, null, []);
    }
  };
}

function saveTaskEntry(date, type, cat, deadline, tasksArr) {
  console.log("saveTaskEntry called with:", { date, type, cat, deadline, tasksArr });
  let today = new Date().toISOString().slice(0, 10);
  let day = tasks.find(t => t.date === date);
  if (!day) {
    day = {
      date, type,
      deadline: type === "future" ? deadline : null,
      sections: {},
      completed: type === "accomplished",
      missed: false
    };
    tasks.push(day);
  }
  day.sections[cat] = tasksArr;
  if (type === "future") day.deadline = deadline;
  console.log("About to call saveTasks with:", tasks);
  try {
    saveTasks(tasks);
    console.log("saveTasks completed successfully");
  } catch (error) {
    console.error("Error calling saveTasks:", error);
  }
  renderTasks();
  checkNotifications();
}

function renderTasks() {
  let taskDiv = document.getElementById('tasks');
  taskDiv.innerHTML = "";
  let today = new Date().toISOString().slice(0, 10);

  let sortTasks = [...tasks].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  sortTasks.forEach((entry, idx) => {
    let cats = Object.keys(entry.sections);
    let isFuture = entry.type === "future";
    let canEditOrDelete = isFuture || (entry.date === today);
    let deadlineStr = isFuture && entry.deadline ? `<span style="color:#fde68a;">Deadline: ${entry.deadline}</span><br>` : '';
    let statusStr = isFuture
      ? (entry.missed ? '<span class="missed">Missed</span>' : '<span class="pending">Pending</span>')
      : (entry.completed ? '<span class="completed">Completed</span>' : '<span class="incomplete">Incomplete</span>');
    let sectionsHTML = cats.map(cat =>
      `<div class="section">
        <div class="section-header">${cat} (${entry.sections[cat].length} task${entry.sections[cat].length > 1 ? "s" : ""})</div>
          <ol>
            ${entry.sections[cat].map((t, i) => {
              return `<li>${t}</li>`;
            }).join('')}
          </ol>
      </div>`
    ).join("");
    taskDiv.innerHTML += `
    <div class="note ${!canEditOrDelete ? 'disabled' : ''}">
        <div><strong>Date:</strong> ${entry.date} ${deadlineStr} <br>
        <strong>Status:</strong> ${statusStr} </div>
        ${sectionsHTML}
        ${canEditOrDelete ?
        `<button class="btn" onclick="editEntry(${idx})">Edit</button>`
        : ""
      }
    </div>`;
  });
}

function editEntry(idx) {
  let entry = tasks[idx];
  let today = new Date().toISOString().slice(0, 10);
  if (!entry.type === "future" && entry.date !== today) return alert("Can only edit today's tasks, or any future tasks.");
  let cats = Object.keys(entry.sections);
  let modal = createModal("Edit a task", `
    <select id="catEditSelect">${cats.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
    <div id="taskSelectDiv"></div>
    <div class="modal-btn-group"><button class="btn" id="chooseCatEdit">Choose Category</button></div>
  `);
  document.body.appendChild(modal);
  document.getElementById("chooseCatEdit").onclick = () => {
    let cat = document.getElementById("catEditSelect").value;
    let tasksInCat = entry.sections[cat] || [];
    if (tasksInCat.length === 0) { alert("No tasks in category."); return; }
    let options = tasksInCat.map((t, i) => `<option value="${i}">${i + 1}. ${t}</option>`).join("");
    document.getElementById("taskSelectDiv").innerHTML =
      `<select id="taskNumSelect">${options}</select>
        <div class="modal-btn-group">
          <button class="btn" id="editSingleBtn">Edit Task</button>
          <button class="btn" id="deleteSingleBtn">Delete Task</button>
        </div>`;
    document.getElementById("editSingleBtn").onclick = () => {
      editSingleTask(idx, cat);
    };
    document.getElementById("deleteSingleBtn").onclick = () => {
      deleteSingleTask(idx, cat);
    };
  };
}

function editSingleTask(idx, cat) {
  let entry = tasks[idx];
  let i = +document.getElementById("taskNumSelect").value;
  let newTask = prompt("Edit this task:", entry.sections[cat][i]);
  if (newTask && newTask.trim()) {
    entry.sections[cat][i] = newTask.trim();
    saveTasks(tasks);
    renderTasks();
    modalRemove();
  }
}

function deleteSingleTask(idx, cat) {
  let entry = tasks[idx];
  let i = +document.getElementById("taskNumSelect").value;
  if (confirm("Delete this task?")) {
    entry.sections[cat].splice(i, 1);
    saveTasks(tasks);
    renderTasks();
    modalRemove();
  }
}

function showPrevTasks() {
  let taskDiv = document.getElementById('tasks');
  let today = new Date().toISOString().slice(0, 10);
  console.log("Today's date:", today);
  console.log("All tasks:", tasks);
  
  let pastList = tasks.filter(t => {
    console.log(`Task date: ${t.date}, type: ${t.type}, is before today: ${t.date < today}`);
    return t.type === "accomplished" && t.date < today;
  });
  
  console.log("Past tasks found:", pastList);
  
  if (pastList.length === 0) {
    alert("No previous tasks found.");
    return;
  }
  let html = pastList.sort((a, b) => a.date.localeCompare(b.date)).map(entry => {
    let cats = Object.keys(entry.sections);
    let sectionsHTML = cats.map(cat =>
      `<div class="section">
          <div class="section-header">${cat}</div>
          <ol>${entry.sections[cat].map((t, i) => `<li>${t}</li>`).join('')}</ol>
       </div>`
    ).join("");
    return `
    <div class="note">
        <div><strong>Date:</strong> ${entry.date}</div>
        <span class="completed">Completed</span>
        ${sectionsHTML}
    </div>`;
  }).join("");
  taskDiv.innerHTML = html;
}

function checkNotifications() {
  let now = new Date();
  let toast = document.getElementById('notification');
  let futureTasks = tasks.filter(t =>
    t.type === "future" &&
    !t.completed && !t.missed
  );
  futureTasks.forEach(t => {
    if (t.deadline && new Date(t.deadline) < now) {
      t.missed = true; t.completed = false;
    }
  });
  saveTasks(tasks);
  if (futureTasks.length > 0 && !notifDismissed) {
    toast.innerHTML =
      `<div class="notif">
        <span>🕒 You have some tasks to do.</span>
        <button class="close" onclick="dismissNotif()">✖</button>
      </div>`;
  } else {
    toast.innerHTML = "";
  }
}

function dismissNotif() {
  notifDismissed = true;
  document.getElementById('notification').innerHTML = "";
}

function exportAndClear() {
  let fullReport = generateReport();
  showReportModal(fullReport);
}

function generateReport() {
  let lines = [];
  lines.push("JOURNAL REPORT\n\n");
  let cloneTasks = [...tasks];
  cloneTasks.sort((a, b) => a.date.localeCompare(b.date));
  cloneTasks.forEach(entry => {
    lines.push(`Date: ${entry.date} ${entry.type === "future" ? `[Deadline: ${entry.deadline}]` : ''}`);
    lines.push(`Status: ${entry.type === "future" ? (entry.missed ? 'Missed' : 'Pending') : (entry.completed ? 'Completed' : 'Incomplete')}`);
    let cats = Object.keys(entry.sections);
    cats.forEach(cat => {
      lines.push(`  Section: ${cat}`);
      entry.sections[cat].forEach((task, i) => {
        lines.push(`     ${i + 1}. ${task}`);
      });
    });
    lines.push('');
  });
  lines.push("\nPrevious Tasks:");
  let prevs = cloneTasks.filter(t => t.type === "accomplished" && t.date < new Date().toISOString().slice(0, 10));
  prevs.forEach(entry => {
    lines.push(`Date: ${entry.date}`);
    let cats = Object.keys(entry.sections);
    cats.forEach(cat => {
      lines.push(`   Section: ${cat}`);
      entry.sections[cat].forEach((task, i) => lines.push(`     ${i + 1}. ${task}`));
    });
  });
  return lines.join('\n');
}

function showReportModal(reportTxt) {
  modalRemove();
  let modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <h2>JOURNAL REPORT</h2>
    <div style="margin-bottom:16px;">
      <button class="btn" onclick="downloadPDF()">Download PDF</button>
      <button class="btn" onclick="clearAll()">Clear All</button>
    </div>
    <pre style="text-align:left; max-height:45vh; overflow:auto; background:#23242a; border-radius:8px; padding: 12px; font-family: monospace; font-size: 1em;">${reportTxt}</pre>
    <div class="modal-backdrop"></div>
    `;
  document.body.appendChild(modal);
  window.reportTxt = reportTxt;
  document.querySelector('.modal-backdrop').onclick = modalRemove;
}

function downloadPDF() {
  let doc = new window.jspdf.jsPDF();
  let lines = window.reportTxt.split('\n');
  doc.setFont('courier', 'normal');
  doc.setFontSize(12);
  let marginLeft = 14;
  let marginTop = 20;
  let lineCount = 0;
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], marginLeft, marginTop + lineCount * 7);
    lineCount++;
    if ((marginTop + lineCount * 7) > 270) {
      doc.addPage();
      marginTop = 20;
      lineCount = 0;
    }
  }
  doc.save('Journal_Report.pdf');
}

function clearAll() {
  if (confirm("Permanently delete all entries and reset journal?")) {
    tasks = [];
    saveTasks(tasks);
    renderTasks();
    modalRemove();
  }
}

function createModal(title, content) {
  modalRemove();
  let backdrop = document.createElement('div');
  backdrop.className = "modal-backdrop";
  backdrop.onclick = modalRemove;
  let modal = document.createElement('div');
  modal.className = "modal";
  modal.innerHTML = `<h2>${title}</h2>${content}`;
  document.body.appendChild(backdrop);
  return modal;
}

function modalRemove() {
  document.querySelectorAll('.modal,.modal-backdrop').forEach(el => el.remove());
}
