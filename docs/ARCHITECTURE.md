# FSEB Technical Architecture

## 1. Overview
**FSEB (Fully Safe Exam Browser)** is an authorized desktop exam browser engineered to provide a controlled, locked-down examination environment on Microsoft Windows while intentionally permitting essential, authorized student operations (such as copying and pasting within exam content and OS window switching).

---

## 2. Security Boundaries & Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Host Operating System                     │
│                        (Windows 10 / 11)                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ .seb File Launch / Process Args
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FSEB Desktop Application                    │
│                                                                 │
│  ┌───────────────────────┐             ┌─────────────────────┐  │
│  │    Platform Layer     │             │    Configuration    │  │
│  │ (WindowsIntegration)  │             │ (SebLoader/Validator│  │
│  └───────────┬───────────┘             └──────────┬──────────┘  │
│              │                                    │             │
│              ▼                                    ▼             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Central ExamSession                     │  │
│  │                      (State Machine)                      │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Central ExamPolicy                      │  │
│  │                                                           │  │
│  │  ├── KeyboardPolicy         ├── NavigationGuard           │  │
│  │  ├── ClipboardPolicy        ├── BrowserPolicy             │  │
│  │  ├── WindowPolicy           ├── DownloadPolicy            │  │
│  │  └── DeveloperToolsPolicy   └── Structured Logger         │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │ Enforces                                │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Chromium BrowserHost                     │  │
│  │         (Isolated WebContents / Sandbox / Zero-Chrome)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Subsystems

### 3.1 Policy Engine (`ExamPolicy`)
Unlike ad-hoc browsers where security checks are scattered across UI event handlers, FSEB centralizes every capability query into the `ExamPolicy` engine:
- **`KeyboardPolicy`**: Intercepts input before standard handling. Permitted actions: `Ctrl+C`, `Ctrl+V`, `Ctrl+A`, cursor navigation, and `Alt+Tab`. Prohibited actions: `F12`, `Ctrl+Shift+I/J/C`, `Ctrl+U`, `Ctrl+P`, `Ctrl+S`, `Ctrl+T/N`, `Ctrl+L/E`, `Ctrl+W`.
- **`ClipboardPolicy`**: Grants permission for clipboard actions without storing, capturing, or logging student clipboard contents.
- **`NavigationGuard`**: Intercepts `will-navigate`, `will-redirect`, and popup requests. Only URLs within the origin of the exam or matching permitted glob patterns in `allowedUrls` are allowed.
- **`WindowPolicy`**: Manages fullscreen presentation and window switching (`Alt+Tab`).
- **`DeveloperToolsPolicy`**: Enforces complete prohibition of DevTools inspection.
- **`DownloadPolicy`**: Intercepts and denies unauthorized file downloads.

### 3.2 State Machine (`ExamSession`)
The application lifecycle is modeled explicitly:
1. `STARTING` — Process initialization and runtime verification.
2. `READY` — Start screen displayed, waiting for `.seb` configuration.
3. `LOADING_CONFIGURATION` — Reading and parsing configuration file.
4. `VALIDATING_CONFIGURATION` — Schema, protocol, and origin verification.
5. `STARTING_EXAM` — Fullscreen Chromium initialization.
6. `EXAM_RUNNING` — Active student examination.
7. `FOCUS_LOST` — Student Alt+Tabs or switches window; session state preserved.
8. `ERROR` — Clear diagnostic presentation with retry option.
9. `CLOSING` — Clean shutdown and session teardown.

### 3.3 Chromium Integration (`BrowserHost`)
- Modern Chromium engine supporting HTML5, WebSockets, HTTPS, CSS Grid/Flexbox, ES modules, cookies, and local/session storage.
- Context isolation and process sandboxing enabled.
- Node.js integration disabled inside web content.
- Custom context menu exposing only authorized clipboard operations (`Copy`, `Paste`, `Select All`) and reload (if allowed).

