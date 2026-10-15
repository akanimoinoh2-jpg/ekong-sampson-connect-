"use strict";

(() => {
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
    message.textContent = text;
    message.dataset.error = String(isError);
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
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
       const button = document.createElement("button");
       button.className = "button outline small";
       button.type = "button";
       button.textContent = project.published ? "Unpublish" : "Publish";
       button.addEventListener("click", async () => {
         button.disabled = true;
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
           button.disabled = false;
         }
       });
       card.append(button);
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
        
        // Show attachment info if exists
        if (issue.attachmentName) {
          const attachmentInfo = document.createElement("p");
          attachmentInfo.style.fontSize = "0.85rem";
          attachmentInfo.style.color = "#666";
          attachmentInfo.style.marginTop = "0.5rem";
          
          const attachmentLink = document.createElement("a");
          attachmentLink.href = `/api/admin/issues/${issue.id}/attachment`;
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
        
        // Color code based on status
        if (issue.status === "new") {
          status.style.color = "#ff9800"; // Orange
        } else if (issue.status === "in progress") {
          status.style.color = "#2196f3"; // Blue
        } else if (issue.status === "resolved") {
          status.style.color = "#4caf50"; // Green
        } else {
          status.style.color = "#9e9e9e"; // Grey
        }
        
        // Action buttons container
        const actions = document.createElement("div");
        actions.style.marginTop = "0.5rem";
        actions.style.display = "flex";
        actions.style.gap = "0.5rem";
        
        // Edit button
        const editButton = document.createElement("button");
        editButton.className = "button outline small";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
          openEditIssueModal(issue);
        });
        
        // Delete button
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
     const result = await request("/api/admin/projects");
     if (!Array.isArray(result.projects)) throw new Error("The server returned an invalid project list.");
     renderProjects(result.projects);
   };

   const loadIssues = async () => {
     console.log('loadIssues: requesting /api/admin/issues');
     const result = await request("/api/admin/issues");
     console.log('loadIssues result:', result);
     if (!Array.isArray(result.issues)) throw new Error("The server returned an invalid issue list.");
     renderIssues(result.issues);
   };

    const setSignedIn = async (username) => {
      console.log('setSignedIn called with username:', username);
      loginPanel.classList.add("hidden");
      workspace.classList.remove("hidden");
      byId("signed-in-user").textContent = username;
      console.log('About to call loadProjects and loadIssues');
      await loadProjects();
      await loadIssues();
      console.log('loadProjects and loadIssues completed');
    };

    // Edit issue modal functionality
    const editModal = byId("edit-issue-modal");
    const editModalClose = byId("edit-issue-close");
    const editModalCancel = byId("edit-issue-cancel");
    const editModalSave = byId("edit-issue-save");
    const editIssueForm = byId("edit-issue-form");
    let currentIssueId = null;

    const openEditIssueModal = (issue) => {
      currentIssueId = issue.id;
      // Populate form with issue data
      byId("edit-issue-name").value = issue.name || "";
      byId("edit-issue-lga").value = issue.lga;
      byId("edit-issue-community").value = issue.community;
      byId("edit-issue-category").value = issue.category;
      byId("edit-issue-message").value = issue.message;
      byId("edit-issue-status").value = issue.status;
      
      // Show modal
      editModal.classList.remove("hidden");
      editModal.setAttribute("aria-hidden", "false");
    };

    const closeEditIssueModal = () => {
      editModal.classList.add("hidden");
      editModal.setAttribute("aria-hidden", "true");
      currentIssueId = null;
      editIssueForm.reset();
    };

    // Modal event listeners
    editModalClose.addEventListener("click", closeEditIssueModal);
    editModalCancel.addEventListener("click", closeEditIssueModal);
    editModal.addEventListener("click", (event) => {
      if (event.target === editModal) {
        closeEditIssueModal();
      }
    });

    // Save changes
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

  byId("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage("Signing in…");
    try {
      const usernameVal = byId("login-username").value;
      const passwordVal = byId("login-password").value;
      console.log('Login attempt:', usernameVal, passwordVal);
      const result = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameVal,
          password: passwordVal
        })
      });
      console.log('Login result:', result);
      await setSignedIn(result.username);
      showMessage("Signed in. You can now manage project updates.");
    } catch (error) {
      showMessage(error.message, true);
      console.error('Login error:', error);
    } finally {
      button.disabled = false;
    }
  });

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

  request("/api/auth/session")
    .then((result) => result.authenticated ? setSignedIn(result.username) : undefined)
    .catch((error) => showMessage(`Could not check the sign-in session: ${error.message}`, true));
})();
