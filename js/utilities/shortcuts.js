/** shortcuts.js **
 *
 * Detects when the user presses Ctrl/⌘ + X, V, Z, Y or Shift-Z, and
 * broadcasts the event to registered listeners.
 * 
 * For undo and redo actions, you can register a single "do" listener
 * and receive the name of the action as part of the callback.
 * 
 * Multiple listeners are possible for each event, but there should be
 * no reason to register more than one.
**/



;(function shortcutsLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }



  class Shortcuts {
    constructor() {
      this.listeners = {
        cut: []
      , paste: []
      , undo: []
      , redo: []
      , do: []
      }

      let listener = this.keyDown.bind(this)
      document.addEventListener("keydown", listener, true)
    }


    keyDown(event) {
      if (event.ctrlKey) {
        switch (event.key) {
          case "v":
          case "V":
            return this._broadcastShortcut("paste")
          case "x":
          case "X":
            return this._broadcastShortcut("cut")
          case "z":
            return this._broadcastShortcut("undo")
          case "Z":
          case "y":
          case "Y":
            return this._broadcastShortcut("redo")
        }
      }
    }


    register(action, callback) {
      let listeners = this.listeners[action]
      if (listeners) {
        if (listeners.indexOf(callback) < 0) {
          listeners.push(callback)
        }
      }
    }


    deregister(action, callback) {
      let listeners = this.listeners[action]

      if (listeners) {
        let index = listeners.indexOf(callback)

        if (index < 0) {

        } else {
          listeners.splice(index, 1)
        }
      }
    }


    _broadcastShortcut(action) {
      let listeners = this.listeners[action]

      listeners.forEach((listener) => {
        listener()
      })

      switch (action) {
        case "undo":
        case "redo":
          listeners = this.listeners.do
          listeners.forEach((listener) => {
            listener(action)
          })
      }
    }
  }



  lx.shortcuts = new Shortcuts()
  
})(window.lexogram)