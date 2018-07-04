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