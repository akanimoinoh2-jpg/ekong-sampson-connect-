"use strict";

const API_BASE = "https://ekong-sampson-connect-3.onrender.com";

(async () => {
  const byId = (id) => document.getElementById(id);
  const loginPanel = byId("login-panel");
  const workspace = byId("workspace");
  const message = byId("admin-message");
  const projectList = byId("admin-project-list");
  const issueList = byId("admin-issue-list");
  const passwordInput = byId("login-password");
  const passwordToggle = byId("password-toggle");

  passwordToggle.addEventListener("click", () => {
    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    passwordToggle.textContent = isVisible ? "Show" : "Hide";
    passwordToggle.setAttribute("aria-pressed", String(!isVisible));
    passwordToggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} password`);
  });

const showMessage = (text, isError = false) => {
  const messageElement = byId("admin-message");
  if (messageElement) {
    messageElement.textContent = text;
    messageElement.dataset.error = String(isError);
  } else {
    console.error("Message element not found:", text, isError);
  }
};

  const request = async (url, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${url}`, { credentials: "include", ...options });
      
      if (!response.ok) {
        let errorMessage = `Request failed (${response.status})`;
        try {
          const errorData = await response.json().catch(() => ({}));
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          errorMessage = `${errorMessage} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json().catch(() => ({}));
      return result;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Unable to connect to server. Please check your network connection and try again.');
      }
      throw error;
    }
   };
   
    const renderProjects = (projects) => {
      projectList.replaceChildren();
      if (!projects.length) {
        const empty = document.createElement("p");
        empty.className = "notice";
        empty.textContent = "No project updates have been added.";
        projectList.append(empty);
        return;
      }
      projects.forEach((project) => {
        const card = document.createElement("article");
        card.className = "admin-project";
        const title = document.createElement("h4");
        title.textContent = project.title;
        const details = document.createElement("p");
        details.textContent = `${project.lga} · ${project.community} · ${project.year} · ${project.status}`;
        const state = document.createElement("p");
        state.textContent = project.published ? "Published on public tracker" : "Unpublished";
        card.append(title, details, state);
        
        const actions = document.createElement("div");
        actions.style.marginTop = "0.5rem";
        actions.style.display = "flex";
        actions.style.gap = "0.5rem";
        
        const editButton = document.createElement("button");
        editButton.className = "button outline small";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
          openEditProjectModal(project);
        });
        
        const deleteButton = document.createElement("button");
        deleteButton.className = "button outline small";
        deleteButton.textContent = "Delete";
        deleteButton.style.backgroundColor = "#ffebee";
        deleteButton.style.color = "#c62828";
        deleteButton.style.borderColor = "#c62828";
        deleteButton.addEventListener("click", async () => {
          if (confirm(`Are you sure you want to delete this project "${project.title}"? This action cannot be undone.`)) {
            try {
              await request(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
                method: "DELETE"
              });
              showMessage("Project deleted successfully.");
              await loadProjects();
            } catch (error) {
              showMessage(error.message, true);
            }
          }
        });
        
        const publishButton = document.createElement("button");
        publishButton.className = "button outline small";
        publishButton.type = "button";
        publishButton.textContent = project.published ? "Unpublish" : "Publish";
        publishButton.addEventListener("click", async () => {
          publishButton.disabled = true;
          try {
            await request(`/api/admin/projects/${encodeURIComponent(project.id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ published: !project.published })
            });
            showMessage(project.published ? "Project update unpublished." : "Project update published.");
            await loadProjects();
          } catch (error) {
            showMessage(error.message, true);
            publishButton.disabled = false;
          }
        });
        
        actions.append(editButton, deleteButton, publishButton);
        card.append(state, actions);
        projectList.append(card);
      });
    };

    const renderIssues = (issues) => {
      issueList.replaceChildren();
      if (!issues.length) {
        const empty = document.createElement("p");
        empty.className = "notice";
        empty.textContent = "No community issues have been submitted.";
        issueList.append(empty);
        return;
      }
      issues.forEach((issue) => {
        const card = document.createElement("article");
        card.className = "admin-issue";
        const title = document.createElement("h4");
        title.textContent = issue.name || "Not provided";
        const details = document.createElement("p");
        details.textContent = `${issue.lga} · ${issue.community} · ${issue.category}`;
        const message = document.createElement("p");
        message.textContent = issue.message;
        message.style.fontSize = "0.9rem";
        message.style.color = "#333";
        card.append(title, details, message);
        
        if (issue.attachmentName) {
          const attachmentInfo = document.createElement("p");
          attachmentInfo.style.fontSize = "0.85rem";
          attachmentInfo.style.color = "#666";
          attachmentInfo.style.marginTop = "0.5rem";
          
          const attachmentLink = document.createElement("a");
          attachmentLink.href = `${API_BASE}/api/admin/issues/${issue.id}/attachment`;
          attachmentLink.textContent = `Download attachment: ${issue.attachmentName}`;
          attachmentLink.target = "_blank";
          
          attachmentInfo.appendChild(attachmentLink);
          card.appendChild(attachmentInfo);
        }
        
        const status = document.createElement("p");
        status.textContent = `Status: ${issue.status}`;
        status.style.fontSize = "0.85rem";
        status.style.fontWeight = "bold";
        status.style.marginTop = "0.5rem";
        
        if (issue.status === "new") {
          status.style.color = "#ff9800";
        } else if (issue.status === "in progress") {
          status.style.color = "#2196f3";
        } else if (issue.status === "resolved") {
          status.style.color = "#4caf50";
        } else {
          status.style.color = "#9e9e9e";
        }
        
        const actions = document.createElement("div");
        actions.style.marginTop = "0.5rem";
        actions.style.display = "flex";
        actions.style.gap = "0.5rem";
        
        const editButton = document.createElement("button");
        editButton.className = "button outline small";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
          openEditIssueModal(issue);
        });
        
        const deleteButton = document.createElement("button");
        deleteButton.className = "button outline small";
        deleteButton.textContent = "Delete";
        deleteButton.style.backgroundColor = "#ffebee";
        deleteButton.style.color = "#c62828";
        deleteButton.style.borderColor = "#c62828";
        deleteButton.addEventListener("click", async () => {
          if (confirm(`Are you sure you want to delete this issue submitted by "${issue.name || "Not provided"}"? This action cannot be undone.`)) {
            try {
              await request(`/api/admin/issues/${encodeURIComponent(issue.id)}`, {
                method: "DELETE"
              });
              showMessage("Issue deleted successfully.");
              await loadIssues();
            } catch (error) {
              showMessage(error.message, true);
            }
          }
        });
        
        actions.append(editButton, deleteButton);
        card.append(status, actions);
        issueList.append(card);
      });
    };

    const loadProjects = async () => {
      try {
        const result = await request("/api/admin/projects");
        if (!Array.isArray(result.projects)) throw new Error("The server returned an invalid project list.");
        renderProjects(result.projects);
      } catch (error) {
        showMessage(`Error loading projects: ${error.message}`, true);
        throw error;
      }
    };

    const loadIssues = async () => {
      try {
        const result = await request("/api/admin/issues");
        if (!Array.isArray(result.issues)) throw new Error("The server returned an invalid issue list.");
        renderIssues(result.issues);
      } catch (error) {
        showMessage(`Error loading issues: ${error.message}`, true);
        throw error;
      }
    };

    const setSignedIn = async (username) => {
      try {
        loginPanel.classList.add("hidden");
        workspace.classList.remove("hidden");
        byId("signed-in-user").textContent = username;
        showMessage("Loading your dashboard…");
        await loadProjects();
        await loadIssues();
        showMessage("Dashboard loaded successfully.");
      } catch (error) {
        showMessage(`Error loading dashboard: ${error.message}`, true);
        loginPanel.classList.remove("hidden");
        workspace.classList.add("hidden");
        byId("signed-in-user").textContent = '';
      }
    };

    const editModal = byId("edit-issue-modal");
    const editModalClose = byId("edit-issue-close");
    const editModalCancel = byId("edit-issue-cancel");
    const editModalSave = byId("edit-issue-save");
    const editIssueForm = byId("edit-issue-form");
    let currentIssueId = null;

    const openEditIssueModal = (issue) => {
      currentIssueId = issue.id;
      byId("edit-issue-name").value = issue.name || "";
      byId("edit-issue-lga").value = issue.lga;
      byId("edit-issue-community").value = issue.community;
      byId("edit-issue-category").value = issue.category;
      byId("edit-issue-message").value = issue.message;
      byId("edit-issue-status").value = issue.status;
      editModal.classList.remove("hidden");
      editModal.setAttribute("aria-hidden", "false");
    };

    const closeEditIssueModal = () => {
      editModal.classList.add("hidden");
      editModal.setAttribute("aria-hidden", "true");
      currentIssueId = null;
      editIssueForm.reset();
    };

    editModalClose.addEventListener("click", closeEditIssueModal);
    editModalCancel.addEventListener("click", closeEditIssueModal);
    editModal.addEventListener("click", (event) => {
      if (event.target === editModal) {
        closeEditIssueModal();
      }
    });

    editModalSave.addEventListener("click", async () => {
      if (!currentIssueId) return;
      editModalSave.disabled = true;
      editModalSave.textContent = "Saving...";
      try {
        const formData = new FormData(editIssueForm);
        const issueData = {};
        formData.forEach((value, key) => {
          issueData[key] = value;
        });
        await request(`/api/admin/issues/${encodeURIComponent(currentIssueId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(issueData)
        });
        showMessage("Issue updated successfully.");
        closeEditIssueModal();
        await loadIssues();
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        editModalSave.disabled = false;
        editModalSave.textContent = "Save Changes";
      }
    });

    const projectEditModal = byId("edit-project-modal");
    const projectEditModalClose = byId("edit-project-close");
    const projectEditModalCancel = byId("edit-project-cancel");
    const projectEditModalSave = byId("edit-project-save");
    const projectEditForm = byId("edit-project-form");
    let currentProjectId = null;

    const openEditProjectModal = (project) => {
      currentProjectId = project.id;
      byId("edit-project-title").value = project.title || "";
      byId("edit-project-lga").value = project.lga;
      byId("edit-project-community").value = project.community;
      byId("edit-project-sector").value = project.sector;
      byId("edit-project-year").value = project.year;
      byId("edit-project-status").value = project.status;
      byId("edit-project-description").value = project.description || "";
      byId("edit-project-funding").value = project.funding || "";
      byId("edit-project-evidence").value = project.evidence || "";
      projectEditModal.classList.remove("hidden");
      projectEditModal.setAttribute("aria-hidden", "false");
    };

    const closeEditProjectModal = () => {
      projectEditModal.classList.add("hidden");
      projectEditModal.setAttribute("aria-hidden", "true");
      currentProjectId = null;
      projectEditForm.reset();
    };

    projectEditModalClose.addEventListener("click", closeEditProjectModal);
    projectEditModalCancel.addEventListener("click", closeEditProjectModal);
    projectEditModal.addEventListener("click", (event) => {
      if (event.target === projectEditModal) {
        closeEditProjectModal();
      }
    });

    projectEditModalSave.addEventListener("click", async () => {
      if (!currentProjectId) return;
      projectEditModalSave.disabled = true;
      projectEditModalSave.textContent = "Saving...";
      try {
        await request(`/api/admin/projects/${encodeURIComponent(currentProjectId)}`, {
          method: "PATCH",
          body: new FormData(projectEditForm)
        });
        showMessage("Project updated successfully.");
        closeEditProjectModal();
        await loadProjects();
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        projectEditModalSave.disabled = false;
        projectEditModalSave.textContent = "Save Changes";
      }
    });

  const loginForm = byId("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const button = loginForm.querySelector("button[type=submit]");
      const usernameInput = byId("login-username");
      const passwordInput = byId("login-password");
      if (!usernameInput || !passwordInput) {
        showMessage("Login form elements not found.", true);
        return;
      }
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username) {
        showMessage("Please enter your username.", true);
        usernameInput.focus();
        return;
      }
      if (!password) {
        showMessage("Please enter your password.", true);
        passwordInput.focus();
        return;
      }
      if (button) {
        button.disabled = true;
        button.originalText = button.textContent;
        button.textContent = "Signing in…";
      }
      try {
        showMessage("Signing in…");
        const result = await request("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            password: password
          })
        });
        if (result.authenticated && result.username) {
          await setSignedIn(result.username);
          showMessage("Signed in successfully. Loading dashboard…");
        } else {
          throw new Error("Invalid login response from server");
        }
      } catch (error) {
        const errorMessage = error.message || "Unknown error occurred during login";
        showMessage(`Login failed: ${errorMessage}`, true);
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      } finally {
        if (button) {
          button.disabled = false;
          if (button.originalText) {
            button.textContent = button.originalText;
          }
        }
      }
    });
  } else {
    console.error("Login form not found in DOM");
  }

  byId("project-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage("Publishing project update…");
    try {
      await request("/api/admin/projects", { method: "POST", body: new FormData(form) });
      form.reset();
      showMessage("Project update published and added to the public tracker.");
      await loadProjects();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  byId("logout-button").addEventListener("click", async () => {
    try {
      await request("/api/auth/logout", { method: "POST" });
      workspace.classList.add("hidden");
      loginPanel.classList.remove("hidden");
      projectList.replaceChildren();
      showMessage("You have signed out.");
    } catch (error) {
      showMessage(error.message, true);
    }
  });

  try {
    const sessionResult = await request("/api/auth/session");
    if (sessionResult.authenticated && sessionResult.username) {
      await setSignedIn(sessionResult.username);
      showMessage("Welcome back! Loading your dashboard…");
    }
  } catch (sessionError) {
    console.debug("Session check failed (user may not be logged in):", sessionError);
  }
})();