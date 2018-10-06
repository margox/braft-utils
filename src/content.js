import { Modifier, EditorState, SelectionState, RichUtils, AtomicBlockUtils, convertFromRaw } from 'draft-js'
import { setBlockData, getSelectionEntity, removeAllInlineStyles, handleNewLine } from 'draftjs-utils'
import { convertHTMLToRaw } from 'braft-convert'

export default {

  isEditorState (editorState) {
    return editorState instanceof EditorState
  },

  createEmptyEditorState (editorDecorators) {
    return EditorState.createEmpty(editorDecorators)
  },

  createEditorState (contentState, editorDecorators) {
    return EditorState.createWithContent(contentState, editorDecorators)
  },

  isSelectionCollapsed (editorState) {
    return editorState.getSelection().isCollapsed()
  },

  selectBlock (editorState, block) {

    const blockKey = block.getKey()

    return EditorState.forceSelection(editorState, new SelectionState({
      anchorKey: blockKey,
      anchorOffset: 0,
      focusKey: blockKey,
      focusOffset: block.getLength()
    }))

  },

  selectNextBlock (editorState, block) {
    const nextBlock = editorState.getCurrentContent().getBlockAfter(block.getKey())
    return nextBlock ? this.selectBlock(editorState, nextBlock) : editorState
  },

  removeBlock (editorState, block, lastSelection = null) {

    let nextContentState, nextEditorState
    const blockKey = block.getKey()

    nextContentState = Modifier.removeRange(editorState.getCurrentContent(), new SelectionState({
      anchorKey: blockKey,
      anchorOffset: 0,
      focusKey: blockKey,
      focusOffset: block.getLength()
    }), 'backward')

    nextContentState = Modifier.setBlockType(nextContentState, nextContentState.getSelectionAfter(), 'unstyled')
    nextEditorState = EditorState.push(editorState, nextContentState, 'remove-range')
    return EditorState.forceSelection(nextEditorState, lastSelection || nextContentState.getSelectionAfter())

  },

  getSelectionBlock (editorState) {
    return editorState.getCurrentContent().getBlockForKey(editorState.getSelection().getAnchorKey())
  },

  setSelectionBlockData (editorState, blockData, override) {

    let newBlockData = override ? blockData : Object.assign({}, this.getSelectionBlockData(editorState).toJS(), blockData)

    Object.keys(newBlockData).forEach(key => {
      if (newBlockData.hasOwnProperty(key) && newBlockData[key] === undefined) {
        delete newBlockData[key]
      }
    })

    return setBlockData(editorState, newBlockData)

  },

  getSelectionBlockData (editorState, name) {
    const blockData = this.getSelectionBlock(editorState).getData()
    return name ? blockData.get(name) : blockData
  },

  getSelectionBlockType (editorState) {
    return this.getSelectionBlock(editorState).getType()
  },

  getSelectionText (editorState) {

    const selectionState = editorState.getSelection()
    const contentState = editorState.getCurrentContent()

    if (selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return ''
    }

    const anchorKey = selectionState.getAnchorKey()
    const currentContentBlock = contentState.getBlockForKey(anchorKey)
    const start = selectionState.getStartOffset()
    const end = selectionState.getEndOffset()

    return currentContentBlock.getText().slice(start, end);

  },

  toggleSelectionBlockType (editorState, blockType) {
    return RichUtils.toggleBlockType(editorState, blockType)
  },

  getSelectionEntityType (editorState) {

    const entityKey = getSelectionEntity(editorState)

    if (entityKey) {
      const entity = editorState.getCurrentContent().getEntity(entityKey)
      return entity ? entity.get('type') : null
    }

    return null

  },

  getSelectionEntityData (editorState, type) {

    const entityKey = getSelectionEntity(editorState)

    if (entityKey) {
      const entity = editorState.getCurrentContent().getEntity(entityKey)
      if (entity && entity.get('type') === type) {
        return entity.getData()
      } else {
        return {}
      }
    } else {
      return {}
    }

  },

  toggleSelectionEntity (editorState, entity) {

    const contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()

    if (selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return editorState
    }

    if (!entity || !entity.type) {
      return EditorState.push(editorState, DraftModifier.applyEntity(contentState, selectionState, null), 'apply-entity')
    }

    try {

      const nextContentState = contentState.createEntity(entity.type, entity.mutability, entity.data)
      const entityKey = nextContentState.getLastCreatedEntityKey()

      let nextEditorState = EditorState.set(editorState, {
        currentContent: nextContentState
      })

      return EditorState.push(nextEditorState, DraftModifier.applyEntity(nextEditorState, selectionState, entityKey), 'apply-entity')

    } catch (error) {
      console.warn(error)
      return editorState
    }

  },

  toggleSelectionLink (editorState, href, target) {

    const contentState = editorState.getCurrentContent()
    const selectionState = editorState.getSelection()

    let entityData = { href, target }

    if (selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return editorState
    }

    if (href === false) {
      return RichUtils.toggleLink(editorState, selectionState, null)
    }

    if (href === null) {
      delete entityData.href
    }

    try {

      const nextContentState = contentState.createEntity('LINK', 'MUTABLE', entityData)
      const entityKey = nextContentState.getLastCreatedEntityKey()

      let nextEditorState = EditorState.set(editorState, {
        currentContent: nextContentState
      })

      nextEditorState = RichUtils.toggleLink(nextEditorState, selectionState, entityKey)
      nextEditorState = EditorState.forceSelection(nextEditorState, selectionState.merge({
        anchorOffset: selectionState.getEndOffset(), 
        focusOffset: selectionState.getEndOffset()
      }))

      nextEditorState = EditorState.push(nextEditorState, Modifier.insertText(
        nextEditorState.getCurrentContent(), nextEditorState.getSelection(), ' '
      ), 'insert-text')

      return nextEditorState

    } catch (error) {
      console.warn(error)
      return editorState
    }

  },

  getSelectionInlineStyle (editorState) {
    return editorState.getCurrentInlineStyle()
  },

  selectionHasInlineStyle (editorState, style) {
    return this.getSelectionInlineStyle(editorState).has(style.toUpperCase())
  },

  toggleSelectionInlineStyle (editorState, style, stylesToBeRemoved = []) {

    const selectionState = editorState.getSelection()
    const contentState = editorState.getCurrentContent()

    style = style.toUpperCase()
    stylesToBeRemoved = stylesToBeRemoved.filter(item => item !== style)

    const nextContentState = stylesToBeRemoved.length ? stylesToBeRemoved.reduce((contentState, item) => {
      return Modifier.removeInlineStyle(contentState, selectionState, item) 
    }, contentState) : contentState

    const nextEditorState = stylesToBeRemoved.length ? EditorState.push(editorState, nextContentState, 'change-inline-style') : editorState
    return RichUtils.toggleInlineStyle(nextEditorState, style)

  },

  removeSelectionInlineStyles (editorState) {
    return removeAllInlineStyles(editorState)
  },

  toggleSelectionAlignment (editorState, alignment) {
    return this.setSelectionBlockData(editorState, {
      textAlign: this.getSelectionBlockData(editorState, 'textAlign') !== alignment ? alignment : undefined
    })
  },

  toggleSelectionIndent (editorState, textIndent, maxIndent = 6) {
    return textIndent < 0 || textIndent > maxIndent || isNaN(textIndent) ? editorState : this.setSelectionBlockData(editorState, {
      textIndent: textIndent || undefined
    })
  },

  increaseSelectionIndent (editorState, maxIndent = 6) {
    const currentIndent = this.getSelectionBlockData(editorState, 'textIndent') || 0
    return this.toggleSelectionIndent(editorState, currentIndent + 1, maxIndent)
  },

  decreaseSelectionIndent (editorState) {
    const currentIndent = this.getSelectionBlockData(editorState, 'textIndent') || 0
    return this.toggleSelectionIndent(editorState, currentIndent - 1)
  },

  toggleSelectionColor (editorState, color, colorList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'COLOR-' + color.replace('#', ''), colorList.map(item => 'COLOR-' + item.replace('#', '').toUpperCase()))
  },

  toggleSelectionBackgroundColor (editorState, color, colorList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'BGCOLOR-' + color.replace('#', ''), colorList.map(item => 'BGCOLOR-' + item.replace('#', '').toUpperCase()))
  },

  toggleSelectionFontSize (editorState, fontSize, fontSizeList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'FONTSIZE-' + fontSize, fontSizeList.map(item => 'FONTSIZE-' + item))
  },

  toggleSelectionLineHeight (editorState, lineHeight, lineHeightList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'LINEHEIGHT-' + lineHeight, lineHeightList.map(item => 'LINEHEIGHT-' + item))
  },

  toggleSelectionFontFamily (editorState, fontFamily, fontFamilyList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'FONTFAMILY-' + fontFamily, fontFamilyList.map(item => 'FONTFAMILY-' + item.name.toUpperCase()))
  },

  toggleSelectionLetterSpacing (editorState, letterSpacing, letterSpacingList = []) {
    return this.toggleSelectionInlineStyle(editorState, 'LETTERSPACING-' + letterSpacing, letterSpacingList.map(item => 'LETTERSPACING-' + item))
  },

  insertText (editorState, text, inlineStyle, entity) {

    const selectionState = editorState.getSelection()
    const currentSelectedBlockType = this.getSelectionBlockType(editorState)

    if (currentSelectedBlockType === 'atomic') {
      return editorState
    }

    let entityKey
    let contentState = editorState.getCurrentContent()

    if (entity && entity.type) {
      contentState = contentState.createEntity(entity.type, entity.mutability || 'MUTABLE', entity.data || entityData)
      entityKey = contentState.getLastCreatedEntityKey()
    }

    if (!selectionState.isCollapsed()) {
      return EditorState.push(editorState, Modifier.replaceText(contentState, selectionState, text, inlineStyle, entityKey), 'replace-text')
    } else {
      return EditorState.push(editorState, Modifier.insertText(contentState, selectionState, text, inlineStyle, entityKey), 'insert-text')
    }

  },

  insertHTML (editorState, htmlString, source) {

    if (!htmlString) {
      return editorState
    }

    const selectionState = editorState.getSelection()
    const contentState = editorState.getCurrentContent()
    const options = editorState.convertOptions || {}

    try {

      const { blockMap } = convertFromRaw(convertHTMLToRaw(htmlString, options, source))

      return EditorState.push(editorState, Modifier.replaceWithFragment(
        contentState, selectionState, blockMap
      ), 'insert-fragment')

    } catch (error) {
      console.warn(error)
      return editorState
    }

  },

  insertAtomicBlock (editorState, type, immutable = true, data = {}) {

    const selectionState = editorState.getSelection()
    const contentState = editorState.getCurrentContent()

    if (!selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return editorState
    }

    const contentStateWithEntity = contentState.createEntity(type, immutable ? 'IMMUTABLE' : 'MUTABLE', data)
    const entityKey = contentStateWithEntity.getLastCreatedEntityKey()
    const newEditorState = AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, ' ')

    return newEditorState

  },

  insertHorizontalLine (editorState) {
    return this.insertAtomicBlock(editorState, 'HR')
  },

  insertMedias (editorState, medias = []) {

    if (!medias.length) {
      return editorState
    }

    if (this.getSelectionBlockType(editorState) === 'atomic') {
      this.selectNextBlock(editorState, this.getSelectionBlock(editorState))
    }

    return medias.reduce((editorState, media) => {
      const { url, name, type, meta } = media
      const contentStateWithEntity = editorState.getCurrentContent().createEntity(type, 'IMMUTABLE', { url, name, type, meta })
      const entityKey = contentStateWithEntity.getLastCreatedEntityKey()
      return AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, ' ')
    }, editorState)

  },

  setMediaData (editorState, entityKey, data) {
    return EditorState.push(editorState, editorState.getCurrentContent().mergeEntityData(entityKey, data), 'change-block-data')
  },

  removeMedia (editorState, mediaBlock) {
    return this.removeBlock(editorState, mediaBlock)
  },

  setMediaPosition (editorState, mediaBlock, position) {

    let newPosition = {}
    const { float, alignment } = position

    if (typeof float !== 'undefined') {
      newPosition.float = mediaBlock.getData().get('float') === float ? null : float
    }

    if (typeof alignment !== 'undefined') {
      newPosition.alignment = mediaBlock.getData().get('alignment') === alignment ? null : alignment
    }

    return this.setSelectionBlockData(this.selectBlock(editorState, mediaBlock), newPosition)

  },

  clear (editorState) {

    const contentState = editorState.getCurrentContent()

    const firstBlock = contentState.getFirstBlock()
    const lastBlock = contentState.getLastBlock()

    const allSelected = new SelectionState({
      anchorKey: firstBlock.getKey(),
      anchorOffset: 0,
      focusKey: lastBlock.getKey(),
      focusOffset: lastBlock.getLength(),
      hasFocus: true
    })

    return EditorState.push(
      editorState,
      Modifier.removeRange(contentState, allSelected, 'backward'),
      'remove-range'
    )

  },

  handleKeyCommand (editorState, command) {
    return RichUtils.handleKeyCommand(editorState, command)
  },

  handleNewLine (editorState, event) {
    return handleNewLine(editorState, event)
  },

  undo (editorState) {
    return EditorState.undo(editorState)
  },

  redo (editorState) {
    return EditorState.redo(editorState)
  }

}