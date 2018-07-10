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

      // <<< HARD-CODED
      this.snippetLength = 15
      // HARD-CODED >>>
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


    /**
     * Gets a tooltip to show in an undo selector
     *
     * @param      {string}  type     "undo" || "redo"
     * @param      {<type>}  oneLine  if falsy, 
     * @return     {string}  The tip.
     */
    getTip(type, oneLine) {
      let tip = this.data[type + "Tip"]
      let snippet = ""

      tip = lx.localize.string(tip, this.data[type + "Sub"])

      if (!oneLine) {
        let text = this.data.text
        snippet = this._getSnippet(text)
      }

      return tip + snippet
    }


    // PROGRESSIVE ACTIONS // PROGRESSIVE ACTIONS // PROGRESSIVE //
    // Examples of a progressive action are typing and deleting. When
    // the user wants to undo or redo such an action, all the letters
    // typed or deleted since the action started should be removed or
    // restored. A whole series of keypresses will be accumulated into
    // one action, using the addStep() method. When a different action
    // is begun, or undo is triggered, the complete() method will be
    // called.


    fix(data) {
      data.fixPoint = this.data.fixPoint
      this.data = data
    }


    addStep(data) {
      switch(data.type) {
        case "backspace":
          return this._addBackspaceStep(data)
        case "delete":
          return this._addDeleteStep(data)
        case "type":
          return this._addTypeStep(data)
      }

      return "Unknown type in UndoAction addStep"
    }


    complete() {
      if (this.data.type === "fix") {
        return false
      }

      return this
    }


    _addBackspaceStep(data) {

    }


    _addDeleteStep(data) {
      
    }
    
    _addTypeStep(data) {
      let text = this.redoData[0] + data.redoData[0]
      let length = text.length

      this.redoData[0] = text
      this.redoTip = lx.localize.string(
        "redoTypeTip"
      , { "%0": length }
      )
     
      this.undoData[1] = data.undoData[1]
      this.undoTip = lx.localize.string(
        "undoTypeTip"
      , { "%0": length
        , "%1": this.undoData[0] +"-"+ this.undoData[1]
        }
      )
    }
    

    /**
     * Called by getTip()
     *
     * @param   {string}  text   A string which may be any length
     * 
     * @return  {string}         Returns a string with a maximum
     *                           length of this.snippetLength * 2 + 5
     *                           If text is longer than this, the 
     *                           middle chunk will be replaced with
     *                           " ... "
     */
    _getSnippet(text) {
      if (/^\s*$/.test(text)) {
        return "\n<whitespace>"
      }

      if (text.length > this.snippetLength * 2 + 5) {
        text = text.substring(0, this.snippetLength)
             + " ... "
             + text.substring(text.length - this.snippetLength)
      }

      return "\n\"" + text + "\""
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

      } else if (type === "fix") {
        result = this._startAction(data)

      } else if (this.currentType === "fix") {
        result = this._fixAction(data)

      } else if (type !== this.currentType) {
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
        let validAction = this.currentAction.complete()

        if (validAction) { // false if currentAction is unused fix
          this.undoStack.push(validAction)
        }

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


    _fixAction(data) {
      this.currentAction.fix(data)
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