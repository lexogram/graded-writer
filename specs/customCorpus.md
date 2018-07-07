Every learner will have a unique "mindprint" of words with which they are familiar. Each individual word may be:

* fully understood in all its meanings
* ...
* recognized as having been seen before, with no memory of the meaning
* known to be unknown

There are many intermediate variations, such as a word with a known meaning in an unknown inflection, a word whose literal meaning is well-known but which takes on a metaphorical meaning in the current context, and an unknown word whose meaning the reader can guess.

It is far from trivial to distinguish these levels automatically. A labour-intensive technique would be to ask the user to estimate the familiarity of each word, but constant questioning will make the app less appealing. A fair compromise would be to guess how well the user knows a word, by measuring their interactions with the word.

* A high-frequency word that the user never selects to look up in a reference can be assumed to be "well-known".
* A high-frequency word that has never been seen before, but that is well within the threshold of "well-known" words can be inferred to be "very familiar"
* A well-known/very familiar word that is only consulted as part of a multi-word chunk can be tagged as potentially having a metaphorical meaning.
* A word that has been consulted, but which has been seen many times recently without prompting a new consultation, can be assumed to be "well-learned".

The aim is to generate a score for each word for each user, and to colour each word accordingly. To do this correctly will require an understanding of machine learning.



# Changing the corpus
———————————————————

Different users will want to use different corpora, and to change the corpus depending on the target audience. Changes may include:

* Changing the language
* Using a specialized vocabulary in a given language
* Loading the specific corpus of a specific (group of) end-user(s)

The user will visit the main page and then choose the corpus from a menu. In the first instance, the corpora will be hard-coded into the JS page and loaded with the app. In later versions, an asynchronous call to a database will be made, and the corpus will be set via a callback.


# Pasting text and loading a complete new file
——————————————————————————————————————————————

The new text needs to be divided into three types of chunks:

- Words
  In English, this should include words with apostrophes, like "John's" and contractions like "he's" and "they're". These should be included in the corpus. (Rarer items like "cathedral's" may be treated as two words.)
- Linebreaks
  These need to be considered differently from whitespace, numbers and punctuation, since /[\r|\r\n|\n]/ sequences need to be replaced with `<br />` tags.
- Whitespace, punctuation, numbers and other non-word characters

The text can be divided in one of two ways:

- First into linebreak chunks and non-linebreak chunks,
  and then the non-linebreak chunks can be broken into words and non-words.
- First into words and non-words, and then the non-words can
  be broken into linebreaks and non-linebreaks.

Aesthetically, the first is more appealing.

The first pass can be to break the text down into a series of arrays (wordBorder, chunk and chunkType), starting at position 0. The second pass can be to insert these one after the other into the current "document". If the document is empty, or if the pasting occurs at the end of the document, there will be no further work to do. If the pasting is before the end of a non-empty document, then the subsequent wordBorder items will need to be updated.


# Colouring and uncolouring words
—————————————————————————————————

The user may alter a word so that it momentarily becomes a string which is not present in the corpus, or which has a much lower level of frequency in the corpus. It would be disturbing if the colour of the word changed as it is typed.

Words should be coloured when:
* a new text is loaded
* a chunk is pasted
If the insertion point is at the end of the last inserted word, or if the pasted text merges words at the end, the last word should not be coloured (or should immediately be uncoloured). If the pasted text ends with a non-word character, and the insertion point is now at the beginning of the following word, the following word should be coloured, even if it has been split.

A word should be uncoloured when
* the text insertion point is moved to/within the word
* a letter is typed. By definition, the insertion point will be at a positive integer index (perhaps at the end of the word)

A word should be coloured when
* a non-word character is typed, so the insertion point is now beyond this non-word character
* the insertion point moves outside a word
  - either from a mouse click or
  - using the arrow keys
  "outside" includes "before the first character". However, typing a new letter before the first character of an existing word places the insertion point after first character of a modified word


## Mouse Event
——————————————

Five cases:
1. Move from non-word to non-word
   - no action, even if non-word changes
2. Move from non-word to word
   - uncolour word
   - scroll to word
3. Move from word to non-word
   - recolour word
4. Move from word A to word B
   - recolour word A
   - uncolour word B
   - scroll to word B
5. Move from word A to word A
   - no action

## Key event
————————————

Six cases:

1. Non-word character in non-word sequence
   - update non-word span
   - (no scroll or colour action)
2. Non-word character splits word sequence
   - truncate word span
   - colour truncated span
   - add non-word spon
   - add split-off word span
   - colour split-off word span
   - set activeNode to new non-word span
   - (no scroll)
3. Non-word character ends word sequence
   - colour (modified) word
   - add or \
              following non-word span
     update /
   - set activeNode to following non-word span
4. Word character splits non-word sequence
   - truncate non-word span
   - create new word span
   - add split-off non-word span
   - set activeNode to new word span
   - scroll to new one-character word
5. Word character prefixes existing word
   - update existing word span
   - remove colour from existing word span
   - scroll to the new word
   - set activeNode to existing word span
6. Word character inserted in, or at the end of, existing word
   - update word span
   - scroll to the new word

In all cases, update following entries in wordBorderArray

## Delete/backspace
———————————————————

1. Delete space and remain outside any words
 a Delete space so insertion point is at end of a word
2. Delete space and collapse two words into one
3. Delete character and produce new word
4. Delete last character of a word, and enter non-word space

## Cut
——————

1. Complete node(s) cut, no split
2. Cut entirely within one node (change, but no split)
3. Node(s) split
   a) Leading edge splits a node, trailing edge at node border
   b) Leading edge at node border, trailing edge splits a node
   c)Both leading and trailing edges split a node

A) Newly consecutive nodes are of different type
   - (no action)
B) Newly consecutive nodes are of same type
   - Merge

In all cases, update following cases in wordBorderArray 

## Paste
————————

A paste into a selection will always start with a cut; a paste without a selection will start with a split if it occurs anywhere but at a boundary.

1. Paste only happens between nodes

Merge nodes when:
A) Preceding node of same type as first pasted node
B) Following node of same type as last pasted node 

## Actions
——————————

Seven possible actions:
0. Do nothing

FEEDBACK
1. Uncolour word
 + scroll to this word
2. Recolour word
   (Batch colour words)

SPANS
3. Modify span
4. Split span
5. Create span
6. Merge spans

HOUSEKEEPING
7. Update wordBorderArray