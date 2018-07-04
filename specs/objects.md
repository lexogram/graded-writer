# Objects

## Management of frequency lists


## Word processor
### Input in textarea

User types into textarea. Text area has no 


### Coloured overlay as p element


### Abstract model of text

A text (which may be empty) is loaded on start-up and a word graph is generated, with the format:

```
{ index: [
    0
  , ...
  , n
  ]
, chunks: [
    <string>
  , ...
  , <string>
  ]
}
```

Chunks will alternate between words and non-words (punctuation and whitespace). Non-word chunks may have multiple characters, such as quotation marks, commas, spaces and line-breaks. The first character in the text will determine whether word chunks occur on odd or even items. Changing the first character may change the parity.

When a chunk of text is selected, the selection may be:

* entirely within one chunk
* an entire chunk
* across chunk boundaries

Any action on this selection (keypress, insertion, deletion) will affect the chunk-group, and may reduce both the number of chunks and the overall length of the text. If the overall length is changed all the indices after the start of the selection need to be updated. Only the text of the selected chunks needs to be revised.

The `value` of the textarea will be updated automatically, but the `innerHTML` of the `<p>` overlay will need to be updated programmatically. The spans that have been affected by the change will have to be removed, and new spans inserted. For this reason, all non-word chunks (even single spaces) should be enclosed in a `<span>` tag, so that the same operation is applied regardless of what type of chunk is being modified.

## Database connection


## Input Manager

### Load
+ Replaces all existing text with a new text
+ Shows the words in the appropriate colour


### Loading and pasting
The overlay `<p>` element starts with just a final span.


## UNDO-REDO

### Paste

`data = {
  type: "paste"
, redoFunction: this.paste.bind(this)
, redoData: [text, insertPoint]
, redoTip
, undoFunction: this.cut.bind(this)
, undoData: [start, end]
}