(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const nav = byId("primary-nav");
  const menu = byId("mobile-toggle");
  const searchPanel = byId("site-search");
  const searchButton = byId("search-open");
  const searchInput = byId("site-search-input");
  const searchFeedback = byId("search-feedback");

  if (menu && nav) {
    const closeMenu = () => {
      nav.classList.remove("open");
      menu.setAttribute("aria-expanded", "false");
      menu.textContent = "Menu";
    };

    menu.addEventListener("click", () => {
      const open = menu.getAttribute("aria-expanded") !== "true";
      menu.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("open", open);
      menu.textContent = open ? "Close" : "Menu";
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("click", (event) => {
      if (menu.getAttribute("aria-expanded") === "true" &&
          !nav.contains(event.target) && !menu.contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
        closeMenu();
        menu.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && menu.getAttribute("aria-expanded") === "true") closeMenu();
    });
  }

  if (searchButton && searchPanel && searchInput) {
    searchButton.addEventListener("click", () => {
      const open = !searchPanel.classList.contains("open");
      searchPanel.classList.toggle("open", open);
      searchButton.setAttribute("aria-expanded", String(open));
      if (open) searchInput.focus();
    });

    const runSiteSearch = () => {
      const query = searchInput.value.trim().toLocaleLowerCase();
      if (!query) {
        searchFeedback.textContent = "Enter a word or phrase to search the content on this page.";
        return;
      }
      const sections = [...document.querySelectorAll("main section[id]")];
      const matching = sections.filter((section) => section.innerText.toLocaleLowerCase().includes(query));
      if (!matching.length) {
        searchFeedback.textContent = `No on-page content matches “${searchInput.value.trim()}”. Try “education”, “Eket”, “news”, “projects” or “community”.`;
        return;
      }
      searchFeedback.textContent = `${matching.length} on-page section${matching.length === 1 ? "" : "s"} match “${searchInput.value.trim()}”. This prototype does not search an external archive.`;
      matching[0].scrollIntoView({ behavior: "smooth", block: "start" });
      matching[0].setAttribute("tabindex", "-1");
      matching[0].focus({ preventScroll: true });
    };
    byId("search-submit").addEventListener("click", runSiteSearch);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSiteSearch();
    });
    document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener("click", () => {
      searchPanel.classList.remove("open");
      searchButton.setAttribute("aria-expanded", "false");
    }));
  }

  const manifestoSearch = byId("manifesto-search");
  const manifestoFilter = byId("manifesto-filter");
  const manifestoFeedback = byId("manifesto-feedback");
  const manifestoThemes = [...document.querySelectorAll(".manifesto-theme")];
  const filterManifesto = () => {
    const query = manifestoSearch.value.trim().toLocaleLowerCase();
    const topic = manifestoFilter.value;
    let shown = 0;
    manifestoThemes.forEach((theme) => {
      const matches = (topic === "all" || theme.dataset.theme === topic)
        && (!query || theme.innerText.toLocaleLowerCase().includes(query));
      theme.classList.toggle("hidden", !matches);
      if (matches) shown += 1;
    });
    manifestoFeedback.textContent = shown
      ? `${shown} theme framework${shown === 1 ? "" : "s"} shown. These are illustrative prompts pending confirmation.`
      : "No theme frameworks match. Clear the search or choose another theme.";
  };
  if (manifestoSearch && manifestoFilter) {
    manifestoSearch.addEventListener("input", filterManifesto);
    manifestoFilter.addEventListener("change", () => {
      filterManifesto();
      const selectedTheme = manifestoThemes.find((theme) => theme.dataset.theme === manifestoFilter.value);
      if (selectedTheme) selectedTheme.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const projectFilters = ["project-lga", "project-community", "project-sector", "project-year", "project-status"]
    .map(byId)
    .filter(Boolean);
  let projectCards = [...document.querySelectorAll(".project[data-status]")];
  const projectFeedback = byId("filter-feedback");
  const projectEmpty = byId("project-empty");
  const projectMap = byId("tracker-map");
  const projectMapSelection = byId("tracker-map-selection");
  const projectMapMarkers = [...document.querySelectorAll("#tracker-map .locator-marker")];
  const projectMapSvg = projectMap?.querySelector("svg");
  if (projectMapSvg) projectMapSvg.setAttribute("role", "group");
  const setProjectView = (view) => {
    const showMap = view === "map";
    if (projectMap) projectMap.classList.toggle("hidden", !showMap);
    document.querySelectorAll(".view-toggle button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
  };
  const filterProjects = () => {
    if (!projectCards.length || !projectFeedback) return;
    const values = projectFilters.map((input) => input.value);
    const [lga, community, sector, year, status] = values;
    const selectedLgaName = projectLgaFilter?.options[projectLgaFilter.selectedIndex]?.text;
    let visible = 0;
    projectCards.forEach((card) => {
      const show = (lga === "all" || card.dataset.lga === lga)
        && (!community || (card.dataset.community || "").toLocaleLowerCase().includes(community.toLocaleLowerCase()))
        && (sector === "all" || card.dataset.sector === sector)
        && (year === "all" || card.dataset.year === year)
        && (status === "all" || card.dataset.status === status);
      card.classList.toggle("hidden", !show);
      if (show) visible += 1;
    });
    if (projectEmpty) {
      projectEmpty.classList.toggle("hidden", visible > 0);
    }
    if (lga !== "all") {
      projectMapMarkers.forEach((marker) => {
        const isSelected = marker.dataset.lga === lga;
        marker.classList.toggle("is-selected", isSelected);
        marker.setAttribute("aria-pressed", String(isSelected));
      });
      if (projectMapSelection) {
        projectMapSelection.textContent = visible
          ? `${selectedLgaName}: ${visible} matching project ${visible === 1 ? "detail is" : "details are"} displayed below.`
          : `${selectedLgaName}: no matching project details are currently listed. This does not establish that no projects exist in the LGA.`;
      }
      projectFeedback.textContent = visible
        ? `${visible} project ${visible === 1 ? "detail" : "details"} shown for ${selectedLgaName}. Entries may be reported or illustrative and require verification.`
        : `No project entries match the selected filters for ${selectedLgaName}.`;
    } else {
      projectMapMarkers.forEach((marker) => {
        marker.classList.remove("is-selected");
        marker.setAttribute("aria-pressed", "false");
      });
      if (projectMapSelection) {
        projectMapSelection.textContent = "All LGAs selected. Choose a particular LGA to highlight it. No project sites are plotted.";
      }
      projectFeedback.textContent = visible
        ? `${visible} project examples shown across all LGAs. Entries may be reported or illustrative and require verification.`
        : "No entries match those filters. No verified project records are currently published.";
    }
  };
  projectFilters.forEach((filter) => filter.addEventListener("input", filterProjects));
  projectFilters.forEach((filter) => filter.addEventListener("change", filterProjects));
  const projectSyncFeedback = byId("project-sync-feedback");
  const refreshProjectUpdates = byId("refresh-project-updates");
  let projectRefreshInProgress = false;
  const loadPublishedProjects = async () => {
    if (!projectSyncFeedback || projectRefreshInProgress) return;
    projectRefreshInProgress = true;
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error(`Project service returned ${response.status}`);
      const result = await response.json();
      const projects = result.projects;
      const projectList = byId("project-list");
      if (!Array.isArray(projects) || !projectList) throw new Error("Project service returned an invalid response.");
      projectList.querySelectorAll(".project[data-published-id]").forEach((card) => card.remove());
      projects.forEach((project) => {
        const card = document.createElement("article");
        card.className = "project";
        card.dataset.publishedId = project.id;
        card.dataset.lga = project.lga;
        card.dataset.community = project.community.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        card.dataset.sector = project.sector;
        card.dataset.year = project.year;
        card.dataset.status = project.status;

        const lgaSelect = byId("project-lga");
        const lgaName = [...lgaSelect.options].find((option) => option.value === project.lga)?.text || project.lga;
        const sectorSelect = byId("project-sector");
        let sectorName = [...sectorSelect.options].find((option) => option.value === project.sector)?.text;
        if (!sectorName) {
          sectorName = project.sector.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
          sectorSelect.add(new Option(sectorName, project.sector));
        }
        const yearSelect = byId("project-year");
        if (![...yearSelect.options].some((option) => option.value === String(project.year))) {
          yearSelect.add(new Option(String(project.year), String(project.year)));
        }
        const meta = document.createElement("div");
        meta.className = "project-meta";
        meta.textContent = `${lgaName} · ${sectorName} · ${project.year}`;
        const title = document.createElement("h3");
        title.textContent = project.title;
        const description = document.createElement("p");
        description.textContent = project.description;
        const status = document.createElement("p");
        status.className = "project-meta";
        status.textContent = `Status reported by project team: ${project.status}`;
        const details = document.createElement("p");
        details.className = "project-meta";
        details.textContent = [project.community, project.funding && `Funding: ${project.funding}`, project.evidence && `Source/evidence: ${project.evidence}`]
          .filter(Boolean).join(" · ");
        card.append(meta, title, description, status, details);
        if (project.imageUrl) {
          const image = document.createElement("img");
          image.className = "project-image";
          image.src = project.imageUrl;
          image.alt = `Image for ${project.title}`;
          image.loading = "lazy";
          card.append(image);
        }
        projectList.append(card);
      });
      projectCards = [...document.querySelectorAll(".project[data-status]")];
      projectSyncFeedback.textContent = projects.length
        ? `${projects.length} project update${projects.length === 1 ? "" : "s"} currently published by the project team.`
        : "No project updates are currently published by the project team.";
      filterProjects();
    } catch (error) {
      console.error("Unable to load project-team updates.", error);
      projectSyncFeedback.textContent = "Project-team updates could not be loaded. Tracker information may be out of date.";
    } finally {
      projectRefreshInProgress = false;
    }
  };
  loadPublishedProjects();
  refreshProjectUpdates?.addEventListener("click", loadPublishedProjects);
  window.addEventListener("focus", loadPublishedProjects);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadPublishedProjects();
  });
  window.setInterval(() => {
    if (document.visibilityState === "visible") loadPublishedProjects();
  }, 30000);
  const viewAllProjects = byId("view-all-projects");
  if (viewAllProjects) {
    viewAllProjects.addEventListener("click", () => {
      projectFilters.forEach((filter) => {
        filter.value = filter.id === "project-community" ? "" : "all";
      });
      filterProjects();
      setProjectView("list");
    });
  }
  document.querySelectorAll(".view-toggle button").forEach((button) => button.addEventListener("click", () => {
    setProjectView(button.dataset.view);
  }));

  const lgaNames = [
    "Eket", "Esit Eket", "Ibeno", "Onna", "Mkpat-Enin", "Ikot Abasi",
    "Eastern Obolo", "Oron", "Mbo", "Okobo", "Udung Uko", "Urue-Offong/Oruko"
  ];
  const lgaFilters = [
    "eket", "esit-eket", "ibeno", "onna", "mkpat-enin", "ikot-abasi",
    "eastern-obolo", "oron", "mbo", "okobo", "udung-uko", "urue-offong-oruko"
  ];
  const lgaFeedback = byId("lga-feedback");
  const lgaTitle = byId("lga-selected-title");
  const projectLgaFilter = byId("project-lga");
  projectMapMarkers.forEach((marker) => {
    const lgaOption = [...projectLgaFilter.options].find((option) => option.value === marker.dataset.lga);
    if (!lgaOption) return;
    marker.setAttribute("role", "button");
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("aria-label", `Select ${lgaOption.text} in the project tracker`);
    const selectLga = () => {
      projectLgaFilter.value = marker.dataset.lga;
      projectLgaFilter.dispatchEvent(new Event("change", { bubbles: true }));
    };
    marker.addEventListener("click", selectLga);
    marker.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLga();
      }
    });
  });
  const describeSelectedLga = (lgaValue, name) => {
    if (!lgaFeedback) return;
    const matchingProjects = projectCards.filter((card) => (
      card.dataset.lga === lgaValue && !card.classList.contains("hidden")
    )).length;
    lgaFeedback.textContent = matchingProjects
      ? `${name}: ${matchingProjects} project ${matchingProjects === 1 ? "detail is" : "details are"} listed in the Project Tracker. Entries require verification.`
      : `${name}: no project details are currently listed. This does not establish that no projects exist in the LGA.`;
  };
  const syncProjectTrackerToLga = (lgaValue) => {
    if (!projectLgaFilter) return;
    const selectedFilter = lgaFilters.includes(lgaValue) ? lgaValue : "all";
    projectLgaFilter.value = selectedFilter;
    if (typeof filterProjects === "function") filterProjects();
  };
  const syncLgaButtonSelection = (selectedIndex) => {
    document.querySelectorAll(".lga-button").forEach((item) => {
      const isSelected = Number(item.dataset.lga) === selectedIndex;
      item.setAttribute("aria-pressed", String(isSelected));
    });
  };
  document.querySelectorAll(".lga-button").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.lga);
    const name = lgaNames[index - 1];
    syncLgaButtonSelection(index);
    if (lgaTitle) lgaTitle.textContent = name;
    const filterValue = lgaFilters[index - 1] || "all";
    if (projectLgaFilter) {
      projectLgaFilter.value = filterValue;
      setProjectView("map");
      if (typeof filterProjects === "function") filterProjects();
    }
    describeSelectedLga(filterValue, name);
    const trackerSection = document.getElementById("tracker");
    if (trackerSection) trackerSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  if (projectLgaFilter) {
    projectLgaFilter.addEventListener("change", () => setProjectView("map"));
    projectLgaFilter.addEventListener("change", () => {
      const selectedIndex = lgaFilters.indexOf(projectLgaFilter.value);
      if (selectedIndex === -1) {
        syncLgaButtonSelection(0);
        return;
      }
      const name = lgaNames[selectedIndex];
      syncLgaButtonSelection(selectedIndex + 1);
      if (lgaTitle) lgaTitle.textContent = name;
      describeSelectedLga(projectLgaFilter.value, name);
    });
  }

  const recordCategory = byId("record-category");
  const recordStatus = byId("record-status");
  const recordFeedback = byId("record-feedback");
  const describeRecordFilter = () => {
    recordFeedback.textContent = `No verified ${recordCategory.value === "all" ? "" : `${recordCategory.options[recordCategory.selectedIndex].text.toLowerCase()} `}records are published${recordStatus.value === "all" ? "." : ` with status “${recordStatus.value}”.`}`;
  };
  if (recordCategory && recordStatus) {
    recordCategory.addEventListener("change", describeRecordFilter);
    recordStatus.addEventListener("change", describeRecordFilter);
  }

  const newsFilter = byId("news-category");
  const newsFeedback = byId("news-feedback");
  if (newsFilter) newsFilter.addEventListener("change", () => {
    newsFeedback.textContent = newsFilter.value === "all"
      ? "No verified stories are published. Archive categories are ready for sourced material."
      : `No verified ${newsFilter.options[newsFilter.selectedIndex].text.toLowerCase()} are published yet.`;
  });

  const documentSearch = byId("document-search");
  const documentCategory = byId("document-category");
  const documentFeedback = byId("document-feedback");
  const searchDocuments = () => {
    if (!documentSearch || !documentCategory || !documentFeedback) return;
    const query = documentSearch.value.trim();
    const category = documentCategory.value;
    documentFeedback.textContent = query
      ? `No published ${category === "all" ? "documents" : documentCategory.options[documentCategory.selectedIndex].text.toLowerCase()} match “${query}”. The library contains no verified files yet.`
      : "No verified documents are currently published. Search applies to this page's defined archive only.";
  };
  const documentSubmit = byId("document-submit");
  if (documentSubmit) documentSubmit.addEventListener("click", searchDocuments);
  if (documentSearch) {
    documentSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") searchDocuments();
    });
  }
  if (documentCategory) documentCategory.addEventListener("change", searchDocuments);

  const localOnlyFeedback = "Prototype only: nothing was sent or saved. Form fields are cleared after this preview; there is no connected office or persistent storage.";
  const issueForm = byId("community-form");
  if (issueForm) {
    issueForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!issueForm.reportValidity()) return;
      const attachmentInput = byId("community-attachment");
      const attachmentSelected = attachmentInput && attachmentInput.files && attachmentInput.files.length > 0;
      issueForm.reset();
      const formFeedback = byId("form-feedback");
      if (formFeedback) {
        formFeedback.textContent = localOnlyFeedback;
        if (attachmentSelected) {
          formFeedback.textContent += " The selected attachment was not uploaded.";
        }
      }
    });
  }

  const enquiryForm = byId("enquiry-form");
  if (enquiryForm) {
    enquiryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      event.currentTarget.reset();
      const enquiryFeedback = byId("enquiry-feedback");
      if (enquiryFeedback) enquiryFeedback.textContent = localOnlyFeedback;
    });
  }

  const shareUrl = (hash) => `${window.location.href.split("#")[0]}${hash}`;
  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  };
  document.querySelectorAll("[data-share]").forEach((button) => button.addEventListener("click", async () => {
    const hash = button.dataset.share;
    const title = button.dataset.title || "Ekong Sampson Connect";
    const url = shareUrl(hash);
    const feedback = byId(button.dataset.feedback);
    if (navigator.share) {
      try {
        await navigator.share({ title, text: "Illustrative policy theme — verify before publication.", url });
        feedback.textContent = "Share sheet opened. This is an illustrative policy framework.";
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    try {
      const copied = await copyText(url);
      feedback.textContent = copied ? "Link copied. The shared content is marked illustrative." : `Copy this link: ${url}`;
    } catch {
      feedback.textContent = `Copy this link: ${url}`;
    }
  }));

  document.querySelectorAll("[data-admin-action]").forEach((button) => button.addEventListener("click", () => {
    byId("admin-feedback").textContent = `${button.dataset.adminAction}: this control is illustrative only. Production publishing requires a protected, authenticated backend; this static prototype cannot save or change site data.`;
  }));

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (nav && menu) {
        nav.classList.remove("open");
        menu.setAttribute("aria-expanded", "false");
        menu.textContent = "Menu";
      }
    });
  });
})();
