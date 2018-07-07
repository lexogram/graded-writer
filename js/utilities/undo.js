/** undo.js **
 *
 * 
**/

;(function undoLoaded(lx){
  "use strict"

  if (!lx) {
    lx = window.lexogram = {}
  }



  class UndoAction {
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
    constructor(shortcutGenerator) {

      if (shortcutGenerator) {
        let listener = this.undo.bind(this)
        shortcutGenerator.register("undo", listener)
        listener = this.redo.bind(this)
        shortcutGenerator.register("redo", listener)
      }

      this.undoStack = []
      this.redoStack = []

      this.progressiveTypes = ["type", "delete", "backspace"]
      // one-off types: "paste", "cut"
      this.currentType = undefined
      this.currentAction = null
    }


    // PUBLIC METHODS // PUBLIC METHODS // PUBLIC METHODS //

    track(data) {
      let type = data.type
      let result

      if (this.progressiveTypes.indexOf(type) < 0) {
        result = this._createAction(data)

      } else if (type !== this.currentType ) {
        result = this._startAction(data)

      } else {
        return this._addStep(data) // don't reset currentType
      }

      this.currentType = type

      return result
    }


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


    // PRIVATE METHODS // PRIVATE METHODS // PRIVATE METHODS //

    _completeCurrentAction() {
      if (this.currentAction) {
        this.currentAction.complete()
        this.undoStack.push(this.currentAction)
        this.currentAction = null
      }
    }


    // PROGRESSIVE ACTIONS // PROGRESSIVE ACTIONS // PROGRESSIVE //

    _startAction(data) {
      this._completeCurrentAction()
      this.currentAction = new UndoAction(data)

      this.redoStack.length = 0

      return "startAction"
    }


    _addStep(data) {
      this.currentAction.addStep(data)

      return "addStep"
    }


    // ONE-OFF ACTIONS // ONE-OFF ACTIONS // ONE-OFF ACTIONS //

    _createAction(data) {
      this._completeCurrentAction()

      let action = new UndoAction(data)
      this.undoStack.push(action)

      this.redoStack.length = 0

      return "createAction"
    }
  }



  lx.undoRedo = new UndoRedo(lx.shortcuts)
  
})(window.lexogram)