/** undo.js **
 *
 * 
**/

;(function undoLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }



  class Action {
    constructor (data) {
      this.data = data 
    }


    undo() {
      // Ensure that undo function is called with ignoreUndo = true
      let data = this.data.undoData.slice(0)
      data.push(true)

      this.data.undoFunction.apply(null, data)
    }


    redo() {
      // Ensure that redo function is called with ignoreUndo = true
      let data = this.data.redoData.slice(0)
      data.push(true)

      this.data.redoFunction.apply(null, data)
    }


    getTip(type) {
      return this.data[type + "Tip"]
    }


    // PROGRESSIVE ACTIONS // PROGRESSIVE ACTIONS // PROGRESSIVE //
    // Examples of a progressive action are typing and deleting. When
    // the user wants to undo or redo such an action, all the letters
    // typed or deleted since the action started should be removed or
    // restored. A whole series of keypresses will be accumulated into
    // one action, using the addStep() method. When a different action
    // is begun, or undo is triggered, the complete() method will be
    // called.


    addStep(data) {

      return "addStep"
    }


    complete() {

      return this
    }
  }



  class UndoRedo {
    constructor() {
      this.undoStack = []
      this.redoStack = []

      this.currentAction = null
    }

    // PROGRESSIVE ACTIONS // PROGRESSIVE ACTIONS // PROGRESSIVE //

    startAction(data) {
      this._completeCurrentAction()
      this.currentAction = new Action(data)

      this.redoStack.length = 0

      return "startAction"
    }


    addStep(data) {
      this.currentAction.addStep(data)

      return "addStep"
    }


    _completeCurrentAction() {
      if (this.currentAction) {
        this.currentAction.complete()
        this.undoStack.push(this.currentAction)
        this.currentAction = null
      }
    }


    // ONE-OFF ACTIONS // ONE-OFF ACTIONS // ONE-OFF ACTIONS //

    createAction(data) {
      this._completeCurrentAction()

      let action = new Action(data)
      this.undoStack.push(action)

      this.redoStack.length = 0

      return "createAction"
    }


    // UNDO AND REDO // UNDO AND REDO // UNDO AND REDO //

    undo() {
      let action

      if (this.currentAction) {
        action = this.currentAction.complete()
      } else {
        action = this.undoStack.pop()
      }

      if (action) {
        action.undo()
        this.redoStack.push(action)
      }

      return this.undoStack.length // if 0, disable undo button 
    }


    redo() {
      let action = this.redoStack.pop()

      if (action) {
        action.redo()
        this.undoStack.push(action)
      }

      return this.redoStack.length // if 0, disable redo button 
    }
  }



  class TrackActions {
    constructor(shortcutGenerator) {
      this.undoRedo = new UndoRedo()
      this.progressiveTypes = ["type", "delete", "backspace"]
      // one-off types: "paste", "cut"
      this.currentType = undefined

      if (shortcutGenerator) {
        let listener = this.undo.bind(this)
        shortcutGenerator.register("undo", listener)
        listener = this.redo.bind(this)
        shortcutGenerator.register("redo", listener)
      }
    }


    track(data) {
      let type = data.type
      let result

      if (this.progressiveTypes.indexOf(type) < 0) {
        result = this.undoRedo.createAction(data)

      } else if (type !== this.currentType ) {
        result = this.undoRedo.startAction(data)

      } else {
        return this.undoRedo.addStep(data) // don't reset currentType
      }

      this.currentType = type

      return result
    }


    undo() {
      console.log("Undo!")
      this.undoRedo.undo()
    }


    redo() {
      console.log("Redo!")
      this.undoRedo.redo()
    }
  }



  lx.trackActions = new TrackActions(lx.shortcuts)
  
})(window.lexogram)