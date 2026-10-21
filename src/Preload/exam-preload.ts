import { contextBridge } from 'electron';

// Expose SafeExamBrowser object expected by assessment platforms (CodeChef, Moodle, etc.)
try {
  contextBridge.exposeInMainWorld('SafeExamBrowser', {
    version: 'SEB_Windows_3.10.2',
    platform: 'Windows',
  });
} catch (err) {
  try {
    (window as unknown as { SafeExamBrowser: unknown }).SafeExamBrowser = {
      version: 'SEB_Windows_3.10.2',
      platform: 'Windows',
    };
  } catch {
    // Ignored
  }
}

// ─── DOM-level clipboard & text selection liberation ───────────────────────────
// Many exam platforms (CodeChef, HackerRank, Moodle) block copy/paste/cut/selection
// by attaching event listeners that call event.preventDefault() and event.stopPropagation().
// We wrap addEventListener BEFORE page scripts run to neutralise preventDefault
// for clipboard events and keyboard copy/paste shortcuts.
try {
  const _addEL = EventTarget.prototype.addEventListener;
  const CLIPBOARD_EVENTS = new Set(['copy', 'cut', 'paste', 'contextmenu', 'selectstart', 'mousedown', 'mouseup']);
  const CLIPBOARD_KEYS = new Set(['c', 'v', 'x', 'a', 'z', 'y', 'insert']);

  EventTarget.prototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) {
    const isClipboardEvent = CLIPBOARD_EVENTS.has(type);
    const isKeyEvent = type === 'keydown' || type === 'keyup';

    if (isClipboardEvent || isKeyEvent) {
      const wrappedListener = function (this: EventTarget, evt: Event) {
        let shouldNeutralize = isClipboardEvent;

        if (isKeyEvent && evt instanceof KeyboardEvent) {
          const keyLower = (evt.key || '').toLowerCase();
          const hasModifier = evt.ctrlKey || evt.metaKey || evt.altKey;
          if (hasModifier && (CLIPBOARD_KEYS.has(keyLower) || keyLower === 'alt')) {
            shouldNeutralize = true;
          }
        }

        if (shouldNeutralize) {
          const origPreventDefault = evt.preventDefault.bind(evt);
          const origStopPropagation = evt.stopPropagation.bind(evt);
          const origStopImmediate = evt.stopImmediatePropagation.bind(evt);

          evt.preventDefault = () => { /* neutralised by FSEB clipboard policy */ };
          evt.stopPropagation = () => { /* neutralised by FSEB clipboard policy */ };
          evt.stopImmediatePropagation = () => { /* neutralised by FSEB clipboard policy */ };

          try {
            if (typeof listener === 'function') {
              listener.call(this, evt);
            } else if (listener && typeof (listener as EventListenerObject).handleEvent === 'function') {
              (listener as EventListenerObject).handleEvent(evt);
            }
          } catch {
            // Ignore listener errors
          }

          evt.preventDefault = origPreventDefault;
          evt.stopPropagation = origStopPropagation;
          evt.stopImmediatePropagation = origStopImmediate;
          return;
        }

        if (typeof listener === 'function') {
          return listener.call(this, evt);
        } else if (listener && typeof (listener as EventListenerObject).handleEvent === 'function') {
          return (listener as EventListenerObject).handleEvent(evt);
        }
      };

      return _addEL.call(this, type, wrappedListener as EventListener, options);
    }

    return _addEL.call(this, type, listener, options);
  };
} catch {
  // Ignored
}

// ─── Neutralise inline property setters (e.g. document.oncopy = ...) ──────────
try {
  const INLINE_HANDLERS = ['oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'onselectstart'] as const;
  for (const prop of INLINE_HANDLERS) {
    const descriptor = {
      get() { return null; },
      set(_v: unknown) { /* blocked by FSEB clipboard policy */ },
      configurable: true,
    };
    Object.defineProperty(HTMLElement.prototype, prop, descriptor);
    Object.defineProperty(Document.prototype, prop, descriptor);
  }
} catch {
  // Ignored
}

// ─── Inject main-world clipboard and text editor liberation ───────────────────
// Injects into the main world so Monaco Editor, textareas, problem descriptions,
// and custom exam elements allow selection, copy, cut, and paste freely.
try {
  const scriptContent = `
(function() {
  'use strict';

  // 1. Force text selectable everywhere (in editor, problem description, tasks, etc.)
  var style = document.createElement('style');
  style.id = 'fseb-clipboard-styles';
  style.textContent = '*, *::before, *::after { -webkit-user-select: text !important; user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; }';

  function injectStyle() {
    if (document.head && !document.getElementById('fseb-clipboard-styles')) {
      document.head.appendChild(style);
    } else if (document.documentElement && !document.getElementById('fseb-clipboard-styles')) {
      document.documentElement.appendChild(style);
    }
  }

  injectStyle();
  document.addEventListener('DOMContentLoaded', injectStyle);

  var obs = new MutationObserver(function() {
    if (!document.getElementById('fseb-clipboard-styles')) {
      injectStyle();
    }
  });
  if (document.documentElement) {
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // 2. Ensure document.execCommand always succeeds for clipboard operations
  var origExecCommand = document.execCommand.bind(document);
  document.execCommand = function(cmd) {
    var lowerCmd = (cmd || '').toLowerCase();
    if (['copy', 'cut', 'paste', 'selectall', 'inserttext', 'delete', 'undo', 'redo'].indexOf(lowerCmd) !== -1) {
      try {
        return origExecCommand.apply(document, arguments);
      } catch (e) {
        return true;
      }
    }
    return origExecCommand.apply(document, arguments);
  };

  // 3. Ensure navigator.clipboard methods are preserved and functional
  if (navigator.clipboard) {
    var origReadText = navigator.clipboard.readText ? navigator.clipboard.readText.bind(navigator.clipboard) : null;
    var origWriteText = navigator.clipboard.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;

    if (origReadText) {
      try {
        Object.defineProperty(navigator.clipboard, 'readText', {
          value: origReadText,
          writable: false,
          configurable: true,
        });
      } catch (e) {}
    }

    if (origWriteText) {
      try {
        Object.defineProperty(navigator.clipboard, 'writeText', {
          value: origWriteText,
          writable: false,
          configurable: true,
        });
      } catch (e) {}
    }
  }

  // 4. Intercept addEventListener in the main page world
  var _mainAddEL = EventTarget.prototype.addEventListener;
  var BLOCKED_TYPES = { copy: 1, cut: 1, paste: 1, contextmenu: 1, selectstart: 1 };
  var CLIP_KEYS = { c: 1, v: 1, x: 1, a: 1, z: 1, y: 1, insert: 1, alt: 1 };

  EventTarget.prototype.addEventListener = function(type, listener, opts) {
    var isClip = BLOCKED_TYPES[type];
    var isKey = (type === 'keydown' || type === 'keyup');

    if (isClip || isKey) {
      var wrapped = function(evt) {
        var neutralize = isClip;
        if (isKey && evt) {
          var k = (evt.key || '').toLowerCase();
          var mod = evt.ctrlKey || evt.metaKey || evt.altKey;
          if (mod && CLIP_KEYS[k]) {
            neutralize = true;
          }
        }

        if (neutralize) {
          var origPD = evt.preventDefault;
          var origSP = evt.stopPropagation;
          var origSIP = evt.stopImmediatePropagation;
          evt.preventDefault = function() {};
          evt.stopPropagation = function() {};
          evt.stopImmediatePropagation = function() {};

          try {
            if (typeof listener === 'function') {
              listener.call(this, evt);
            } else if (listener && listener.handleEvent) {
              listener.handleEvent(evt);
            }
          } catch (e) {}

          evt.preventDefault = origPD;
          evt.stopPropagation = origSP;
          evt.stopImmediatePropagation = origSIP;
          return;
        }

        if (typeof listener === 'function') {
          return listener.call(this, evt);
        } else if (listener && listener.handleEvent) {
          return listener.handleEvent(evt);
        }
      };

      return _mainAddEL.call(this, type, wrapped, opts);
    }

    return _mainAddEL.call(this, type, listener, opts);
  };

  // 5. Neutralise inline handlers in the main world
  ['oncopy', 'oncut', 'onpaste', 'oncontextmenu', 'onselectstart'].forEach(function(prop) {
    try {
      Object.defineProperty(HTMLElement.prototype, prop, {
        get: function() { return null; },
        set: function() {},
        configurable: true,
      });
      Object.defineProperty(Document.prototype, prop, {
        get: function() { return null; },
        set: function() {},
        configurable: true,
      });
    } catch (e) {}
  });

  // 6. Ensure getSelection always returns a valid selection object
  var _origGetSelection = window.getSelection;
  window.getSelection = function() {
    var sel = _origGetSelection.call(window);
    return sel || { toString: function() { return ''; }, rangeCount: 0 };
  };

})();
`;

  const scriptEl = document.createElement('script');
  scriptEl.textContent = scriptContent;

  if (document.documentElement) {
    document.documentElement.prepend(scriptEl);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.documentElement.prepend(scriptEl);
    });
  }
} catch {
  // Ignored
}
