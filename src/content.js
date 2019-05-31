import { Modifier, EditorState, SelectionState, RichUtils, CharacterMetadata, AtomicBlockUtils, convertFromRaw } from 'draft-js'
import { setBlockData, getSelectionEntity } from 'draftjs-utils'
import { convertHTMLToRaw } from 'braft-convert'
import Immutable from 'immutable'

const strictBlockTypes = ['atomic']

export const registerStrictBlockType = (blockType) => {
  strictBlockTypes.indexOf(blockType) === -1 && strictBlockTypes.push(blockType)
}

export const isEditorState = (editorState) => {
  return editorState instanceof EditorState
}

export const createEmptyEditorState = (editorDecorators) => {
  return EditorState.createEmpty(editorDecorators)
}

export const createEditorState = (contentState, editorDecorators) => {
  return EditorState.createWithContent(contentState, editorDecorators)
}

export const isSelectionCollapsed = (editorState) => {
  return editorState.getSelection().isCollapsed()
}

export const selectionContainsBlockType = (editorState, blockType) => {
  return getSelectedBlocks(editorState).find(block => block.getType() === blockType)
}

export const selectionContainsStrictBlock = (editorState) => {
  return getSelectedBlocks(editorState).find(block => ~strictBlockTypes.indexOf(block.getType()))
}

export const selectBlock = (editorState, block) => {

  const blockKey = block.getKey()

  return EditorState.forceSelection(editorState, new SelectionState({
    anchorKey: blockKey,
    anchorOffset: 0,
    focusKey: blockKey,
    focusOffset: block.getLength()
  }))

}

export const selectNextBlock = (editorState, block) => {
  const nextBlock = editorState.getCurrentContent().getBlockAfter(block.getKey())
  return nextBlock ? selectBlock(editorState, nextBlock) : editorState
}

export const removeBlock = (editorState, block, lastSelection = null) => {

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

}

export const getSelectionBlock = (editorState) => {
  return editorState.getCurrentContent().getBlockForKey(editorState.getSelection().getAnchorKey())
}

export const updateEachCharacterOfSelection = (editorState, callback) => {

  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()
  const contentBlocks = contentState.getBlockMap()
  const selectedBlocks = getSelectedBlocks(editorState)

  if (selectedBlocks.length === 0) {
    return editorState
  }

  const startKey = selectionState.getStartKey()
  const startOffset = selectionState.getStartOffset()
  const endKey = selectionState.getEndKey()
  const endOffset = selectionState.getEndOffset()

  const nextContentBlocks = contentBlocks.map((block) => {

    if (selectedBlocks.indexOf(block) === -1) {
      return block
    }

    const blockKey = block.getKey()
    const charactersList = block.getCharacterList()
    let nextCharactersList = null

    if (blockKey === startKey && blockKey === endKey) {
      nextCharactersList = charactersList.map((character, index) => {
        if (index >= startOffset && index < endOffset) {
          return callback(character)
        }
        return character
      })
    } else if (blockKey === startKey) {
      nextCharactersList = charactersList.map((character, index) => {
        if (index >= startOffset) {
          return callback(character)
        }
        return character
      })
    } else if (blockKey === endKey) {
      nextCharactersList = charactersList.map((character, index) => {
        if (index < endOffset) {
          return callback(character)
        }
        return character
      })
    } else {
      nextCharactersList = charactersList.map((character) => {
        return callback(character)
      })
    }

    return block.merge({
      'characterList': nextCharactersList
    })

  })

  return EditorState.push(editorState, contentState.merge({
    blockMap: nextContentBlocks,
    selectionBefore: selectionState,
    selectionAfter: selectionState
  }), 'update-selection-character-list')

}

export const getSelectedBlocks = (editorState) => {

  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()

  const startKey = selectionState.getStartKey()
  const endKey = selectionState.getEndKey()
  const isSameBlock = startKey === endKey
  const startingBlock = contentState.getBlockForKey(startKey)
  const selectedBlocks = [startingBlock]

  if (!isSameBlock) {
    let blockKey = startKey

    while (blockKey !== endKey) {
      const nextBlock = contentState.getBlockAfter(blockKey)
      selectedBlocks.push(nextBlock)
      blockKey = nextBlock.getKey()
    }
  }

  return selectedBlocks

}

export const setSelectionBlockData = (editorState, blockData, override) => {

  let newBlockData = override ? blockData : Object.assign({}, getSelectionBlockData(editorState).toJS(), blockData)

  Object.keys(newBlockData).forEach(key => {
    if (newBlockData.hasOwnProperty(key) && newBlockData[key] === undefined) {
      delete newBlockData[key]
    }
  })

  return setBlockData(editorState, newBlockData)

}

export const getSelectionBlockData = (editorState, name) => {
  const blockData = getSelectionBlock(editorState).getData()
  return name ? blockData.get(name) : blockData
}

export const getSelectionBlockType = (editorState) => {
  return getSelectionBlock(editorState).getType()
}

export const getSelectionText = (editorState) => {

  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()

  if (selectionState.isCollapsed() || getSelectionBlockType(editorState) === 'atomic') {
    return ''
  }

  const anchorKey = selectionState.getAnchorKey()
  const currentContentBlock = contentState.getBlockForKey(anchorKey)
  const start = selectionState.getStartOffset()
  const end = selectionState.getEndOffset()

  return currentContentBlock.getText().slice(start, end)

}

export const toggleSelectionBlockType = (editorState, blockType) => {

  if (selectionContainsStrictBlock(editorState)) {
    return editorState
  }

  return RichUtils.toggleBlockType(editorState, blockType)

}

export const getSelectionEntityType = (editorState) => {

  const entityKey = getSelectionEntity(editorState)

  if (entityKey) {
    const entity = editorState.getCurrentContent().getEntity(entityKey)
    return entity ? entity.get('type') : null
  }

  return null

}

export const getSelectionEntityData = (editorState, type) => {

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

}

export const toggleSelectionEntity = (editorState, entity) => {

  const contentState = editorState.getCurrentContent()
  const selectionState = editorState.getSelection()

  if (selectionState.isCollapsed() || getSelectionBlockType(editorState) === 'atomic') {
    return editorState
  }

  if (!entity || !entity.type || getSelectionEntityType(editorState) === entity.type) {
    return EditorState.push(editorState, Modifier.applyEntity(contentState, selectionState, null), 'apply-entity')
  }

  try {

    const nextContentState = contentState.createEntity(entity.type, entity.mutability, entity.data)
    const entityKey = nextContentState.getLastCreatedEntityKey()

    let nextEditorState = EditorState.set(editorState, {
      currentContent: nextContentState
    })

    return EditorState.push(nextEditorState, Modifier.applyEntity(nextContentState, selectionState, entityKey), 'apply-entity')

  } catch (error) {
    console.warn(error)
    return editorState
  }

}

export const toggleSelectionLink = (editorState, href, target) => {

  const contentState = editorState.getCurrentContent()
  const selectionState = editorState.getSelection()

  let entityData = { href, target }

  if (selectionState.isCollapsed() || getSelectionBlockType(editorState) === 'atomic') {
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
      nextEditorState.getCurrentContent(), nextEditorState.getSelection(), ''
    ), 'insert-text')

    return nextEditorState

  } catch (error) {
    console.warn(error)
    return editorState
  }

}

export const getSelectionInlineStyle = (editorState) => {
  return editorState.getCurrentInlineStyle()
}

export const selectionHasInlineStyle = (editorState, style) => {
  return getSelectionInlineStyle(editorState).has(style.toUpperCase())
}

export const toggleSelectionInlineStyle = (editorState, style, prefix = '') => {

  let nextEditorState = editorState
  style = prefix + style.toUpperCase()

  if (prefix) {

    nextEditorState = updateEachCharacterOfSelection(nextEditorState, (characterMetadata) => {

      return characterMetadata.toJS().style.reduce((characterMetadata, characterStyle) => {
        if (characterStyle.indexOf(prefix) === 0 && style !== characterStyle) {
          return CharacterMetadata.removeStyle(characterMetadata, characterStyle)
        } else {
          return characterMetadata
        }
      }, characterMetadata)

    })

  }

  return RichUtils.toggleInlineStyle(nextEditorState, style)

}

export const removeSelectionInlineStyles = (editorState) => {

  return updateEachCharacterOfSelection(editorState, (characterMetadata) => {
    return characterMetadata.merge({
      style: Immutable.OrderedSet([])
    })
  })

}

export const toggleSelectionAlignment = (editorState, alignment) => {
  return setSelectionBlockData(editorState, {
    textAlign: getSelectionBlockData(editorState, 'textAlign') !== alignment ? alignment : undefined
  })
}

export const toggleSelectionIndent = (editorState, textIndent, maxIndent = 6) => {
  return textIndent < 0 || textIndent > maxIndent || isNaN(textIndent) ? editorState : setSelectionBlockData(editorState, {
    textIndent: textIndent || undefined
  })
}

export const increaseSelectionIndent = (editorState, maxIndent = 6) => {
  const currentIndent = getSelectionBlockData(editorState, 'textIndent') || 0
  return toggleSelectionIndent(editorState, currentIndent + 1, maxIndent)
}

export const decreaseSelectionIndent = (editorState, maxIndent) => {
  const currentIndent = getSelectionBlockData(editorState, 'textIndent') || 0
  return toggleSelectionIndent(editorState, currentIndent - 1, maxIndent)
}

export const toggleSelectionColor = (editorState, color) => {
  return toggleSelectionInlineStyle(editorState, color.replace('#', ''), 'COLOR-')
}

export const toggleSelectionBackgroundColor = (editorState, color) => {
  return toggleSelectionInlineStyle(editorState, color.replace('#', ''), 'BGCOLOR-')
}

export const toggleSelectionFontSize = (editorState, fontSize) => {
  return toggleSelectionInlineStyle(editorState, fontSize, 'FONTSIZE-')
}

export const toggleSelectionLineHeight = (editorState, lineHeight) => {
  return toggleSelectionInlineStyle(editorState,  lineHeight, 'LINEHEIGHT-')
}

export const toggleSelectionFontFamily = (editorState, fontFamily) => {
  return toggleSelectionInlineStyle(editorState, fontFamily, 'FONTFAMILY-')
}

export const toggleSelectionLetterSpacing = (editorState, letterSpacing) => {
  return toggleSelectionInlineStyle(editorState, letterSpacing, 'LETTERSPACING-')
}

export const insertText = (editorState, text, inlineStyle, entity) => {

  const selectionState = editorState.getSelection()
  const currentSelectedBlockType = getSelectionBlockType(editorState)

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

}

export const insertHTML = (editorState, htmlString, source) => {

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

}

export const insertAtomicBlock = (editorState, type, immutable = true, data = {}) => {

  if (selectionContainsStrictBlock(editorState)) {
    return insertAtomicBlock(selectNextBlock(editorState, getSelectionBlock(editorState)), type, immutable, data)
  }

  const selectionState = editorState.getSelection()
  const contentState = editorState.getCurrentContent()

  if (!selectionState.isCollapsed() || getSelectionBlockType(editorState) === 'atomic') {
    return editorState
  }

  const contentStateWithEntity = contentState.createEntity(type, immutable ? 'IMMUTABLE' : 'MUTABLE', data)
  const entityKey = contentStateWithEntity.getLastCreatedEntityKey()
  const newEditorState = AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, ' ')

  return newEditorState

}

export const insertHorizontalLine = (editorState) => {
  return insertAtomicBlock(editorState, 'HR')
}

export const insertMedias = (editorState, medias = []) => {

  if (!medias.length) {
    return editorState
  }

  return medias.reduce((editorState, media) => {
    const { url, link, link_target, name, type, width, height, meta } = media
    return insertAtomicBlock(editorState, type, true, { url, link, link_target, name, type, width, height, meta })
  }, editorState)

}

export const setMediaData = (editorState, entityKey, data) => {
  return EditorState.push(editorState, editorState.getCurrentContent().mergeEntityData(entityKey, data), 'change-block-data')
}

export const removeMedia = (editorState, mediaBlock) => {
  return removeBlock(editorState, mediaBlock)
}

export const setMediaPosition = (editorState, mediaBlock, position) => {

  let newPosition = {}
  const { float, alignment } = position

  if (typeof float !== 'undefined') {
    newPosition.float = mediaBlock.getData().get('float') === float ? null : float
  }

  if (typeof alignment !== 'undefined') {
    newPosition.alignment = mediaBlock.getData().get('alignment') === alignment ? null : alignment
  }

  return setSelectionBlockData(selectBlock(editorState, mediaBlock), newPosition)

}

export const clear = (editorState) => {

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

  return RichUtils.toggleBlockType(EditorState.push(
    editorState,
    Modifier.removeRange(contentState, allSelected, 'backward'),
    'remove-range'
  ), 'unstyled')

}

export const handleKeyCommand = (editorState, command) => {
  return RichUtils.handleKeyCommand(editorState, command)
}

export const undo = (editorState) => {
  return EditorState.undo(editorState)
}

export const redo = (editorState) => {
  return EditorState.redo(editorState)
}
