'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _draftJs = require('draft-js');

var _draftjsUtils = require('draftjs-utils');

var _color = require('./color');

var _braftConvert = require('braft-convert');

exports.default = {
  isEditorState: function isEditorState(editorState) {
    return editorState instanceof _draftJs.EditorState;
  },
  createEmptyEditorState: function createEmptyEditorState(editorDecorators) {
    return _draftJs.EditorState.createEmpty(editorDecorators);
  },
  createEditorState: function createEditorState(contentState, editorDecorators) {
    return _draftJs.EditorState.createWithContent(contentState, editorDecorators);
  },
  isSelectionCollapsed: function isSelectionCollapsed(editorState) {
    return editorState.getSelection().isCollapsed();
  },
  selectBlock: function selectBlock(editorState, block) {

    var blockKey = block.getKey();

    return _draftJs.EditorState.forceSelection(editorState, new _draftJs.SelectionState({
      anchorKey: blockKey,
      anchorOffset: 0,
      focusKey: blockKey,
      focusOffset: block.getLength()
    }));
  },
  selectNextBlock: function selectNextBlock(editorState, block) {
    var nextBlock = editorState.getCurrentContent().getBlockAfter(block.getKey());
    return nextBlock ? this.selectBlock(editorState, nextBlock) : editorState;
  },
  removeBlock: function removeBlock(editorState, block) {
    var lastSelection = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;


    var nextContentState = void 0,
        nextEditorState = void 0;
    var blockKey = block.getKey();

    nextContentState = _draftJs.Modifier.removeRange(editorState.getCurrentContent(), new _draftJs.SelectionState({
      anchorKey: blockKey,
      anchorOffset: 0,
      focusKey: blockKey,
      focusOffset: block.getLength()
    }), 'backward');

    nextContentState = _draftJs.Modifier.setBlockType(nextContentState, nextContentState.getSelectionAfter(), 'unstyled');
    nextEditorState = _draftJs.EditorState.push(editorState, nextContentState, 'remove-range');
    return _draftJs.EditorState.forceSelection(nextEditorState, lastSelection || nextContentState.getSelectionAfter());
  },
  getSelectionBlock: function getSelectionBlock(editorState) {
    return editorState.getCurrentContent().getBlockForKey(editorState.getSelection().getAnchorKey());
  },
  setSelectionBlockData: function setSelectionBlockData(editorState, blockData, override) {

    if (override) {
      return (0, _draftjsUtils.setBlockData)(editorState, blockData);
    } else {
      var allBlockData = this.getSelectionBlockData(editorState).toJS();
      return (0, _draftjsUtils.setBlockData)(editorState, Object.assign({}, allBlockData, blockData));
    }
  },
  getSelectionBlockData: function getSelectionBlockData(editorState, name) {
    var blockData = this.getSelectionBlock(editorState).getData();
    return name ? blockData.get(name) : blockData;
  },
  getSelectionBlockType: function getSelectionBlockType(editorState) {
    return this.getSelectionBlock(editorState).getType();
  },
  getSelectionText: function getSelectionText(editorState) {

    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();

    if (selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return '';
    }

    var anchorKey = selectionState.getAnchorKey();
    var currentContentBlock = contentState.getBlockForKey(anchorKey);
    var start = selectionState.getStartOffset();
    var end = selectionState.getEndOffset();

    return currentContentBlock.getText().slice(start, end);
  },
  toggleSelectionBlockType: function toggleSelectionBlockType(editorState, blockType) {
    return _draftJs.RichUtils.toggleBlockType(editorState, blockType);
  },
  getSelectionEntityData: function getSelectionEntityData(editorState, type) {

    var entityKey = (0, _draftjsUtils.getSelectionEntity)(editorState);

    if (entityKey) {
      var entity = editorState.getCurrentContent().getEntity(entityKey);
      if (entity && entity.get('type') === type) {
        var _entity$getData = entity.getData(),
            href = _entity$getData.href,
            target = _entity$getData.target;

        return { href: href, target: target };
      } else {
        return {};
      }
    } else {
      return {};
    }
  },
  getSelectionInlineStyle: function getSelectionInlineStyle(editorState) {
    return editorState.getCurrentInlineStyle();
  },
  selectionHasInlineStyle: function selectionHasInlineStyle(editorState, style) {
    return this.getSelectionInlineStyle(editorState).has(style.toUpperCase());
  },
  toggleSelectionInlineStyle: function toggleSelectionInlineStyle(editorState, style) {
    var stylesToBeRemoved = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];


    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();

    style = style.toUpperCase();
    stylesToBeRemoved = stylesToBeRemoved.filter(function (item) {
      return item !== style;
    });

    var nextContentState = stylesToBeRemoved.length ? stylesToBeRemoved.reduce(function (contentState, item) {
      return _draftJs.Modifier.removeInlineStyle(contentState, selectionState, item);
    }, contentState) : contentState;

    var nextEditorState = stylesToBeRemoved.length ? _draftJs.EditorState.push(editorState, nextContentState, 'change-inline-style') : editorState;
    return _draftJs.RichUtils.toggleInlineStyle(nextEditorState, style);
  },
  removeSelectionInlineStyles: function removeSelectionInlineStyles(editorState) {
    return (0, _draftjsUtils.removeAllInlineStyles)(editorState);
  },
  toggleSelectionAlignment: function toggleSelectionAlignment(editorState, alignment) {
    return this.setSelectionBlockData(editorState, {
      textAlign: this.getSelectionBlockData(editorState, 'textAlign') !== alignment ? alignment : undefined
    });
  },
  toggleSelectionIndent: function toggleSelectionIndent(editorState, textIndent) {
    var maxIndent = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 6;

    return textIndent <= 0 || textIndent > maxIndent || isNaN(textIndent) ? editorState : this.setSelectionBlockData(editorState, { textIndent: textIndent });
  },
  increaseSelectionIndent: function increaseSelectionIndent(editorState) {
    var maxIndent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 6;

    var currentIndent = this.getSelectionBlockData(editorState, 'textIndent');
    return this.setSelectionBlockData(editorState, currentIndent + 1, maxIndent);
  },
  decreaseSelectionIndent: function decreaseSelectionIndent(editorState) {
    var currentIndent = this.getSelectionBlockData(editorState, 'textIndent');
    return this.setSelectionBlockData(editorState, currentIndent - 1);
  },
  toggleSelectionColor: function toggleSelectionColor(editorState, color) {
    var colorList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'COLOR-' + color.replace('#', ''), colorList.map(function (item) {
      return 'COLOR-' + item.replace('#', '').toUpperCase();
    }));
  },
  toggleSelectionBackgroundColor: function toggleSelectionBackgroundColor(editorState, color) {
    var colorList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'BGCOLOR-' + color.replace('#', ''), colorList.map(function (item) {
      return 'BGCOLOR-' + item.replace('#', '').toUpperCase();
    }));
  },
  toggleSelectionFontSize: function toggleSelectionFontSize(editorState, fontSize) {
    var fontSizeList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'FONTSIZE-' + fontSize, fontSizeList.map(function (item) {
      return 'FONTSIZE-' + item;
    }));
  },
  toggleSelectionLineHeight: function toggleSelectionLineHeight(editorState, lineHeight) {
    var lineHeightList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'LINEHEIGHT-' + lineHeight, lineHeightList.map(function (item) {
      return 'LINEHEIGHT-' + item;
    }));
  },
  toggleSelectionFontFamily: function toggleSelectionFontFamily(editorState, fontFamily) {
    var fontFamilyList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'FONTFAMILY-' + fontFamily, fontFamilyList.map(function (item) {
      return 'FONTFAMILY-' + item.name.toUpperCase();
    }));
  },
  toggleSelectionLetterSpacing: function toggleSelectionLetterSpacing(editorState, letterSpacing) {
    var letterSpacingList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

    return this.toggleSelectionInlineStyle(editorState, 'LETTERSPACING-' + letterSpacing, letterSpacingList.map(function (item) {
      return 'LETTERSPACING-' + item;
    }));
  },
  toggleSelectionLink: function toggleSelectionLink(editorState, href, target) {

    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();

    var entityData = { href: href, target: target };

    if (selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return editorState;
    }

    if (href === false) {
      return _draftJs.RichUtils.toggleLink(editorState, selectionState, null);
    }

    if (href === null) {
      delete entityData.href;
    }

    try {

      var nextContentState = contentState.createEntity('LINK', 'MUTABLE', entityData);
      var entityKey = nextContentState.getLastCreatedEntityKey();

      var nextEditorState = _draftJs.EditorState.set(editorState, {
        currentContent: nextContentState
      });

      nextEditorState = _draftJs.RichUtils.toggleLink(nextEditorState, selectionState, entityKey);
      nextEditorState = _draftJs.EditorState.forceSelection(nextEditorState, selectionState.merge({
        anchorOffset: selectionState.getEndOffset(),
        focusOffset: selectionState.getEndOffset()
      }));

      nextEditorState = _draftJs.EditorState.push(nextEditorState, _draftJs.Modifier.insertText(nextEditorState.getCurrentContent(), nextEditorState.getSelection(), ' '), 'insert-text');

      return nextEditorState;
    } catch (error) {
      console.warn(error);
      return editorState;
    }
  },
  insertText: function insertText(editorState, text) {
    var replace = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;


    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();
    var currentSelectedBlockType = this.getSelectionBlockType(editorState);

    if (currentSelectedBlockType === 'atomic') {
      return editorState;
    }

    if (!selectionState.isCollapsed()) {
      return replace ? _draftJs.EditorState.push(editorState, _draftJs.Modifier.replaceText(contentState, selectionState, text), 'replace-text') : editorState;
    } else {
      return _draftJs.EditorState.push(editorState, _draftJs.Modifier.insertText(contentState, selectionState, text), 'insert-text');
    }
  },
  insertHTML: function insertHTML(editorState, htmlString) {

    if (!htmlString) {
      return editorState;
    }

    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();

    try {
      var _convertFromRaw = (0, _draftJs.convertFromRaw)((0, _braftConvert.convertHTMLToRaw)(htmlString)),
          blockMap = _convertFromRaw.blockMap;

      return _draftJs.EditorState.push(editorState, _draftJs.Modifier.replaceWithFragment(contentState, selectionState, blockMap), 'insert-fragment');
    } catch (error) {
      console.warn(error);
      return editorState;
    }
  },
  insertAtomicBlock: function insertAtomicBlock(editorState, type) {
    var immutable = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var data = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};


    var selectionState = editorState.getSelection();
    var contentState = editorState.getCurrentContent();

    if (!selectionState.isCollapsed() || this.getSelectionBlockType(editorState) === 'atomic') {
      return editorState;
    }

    var contentStateWithEntity = contentState.createEntity(type, immutable ? 'IMMUTABLE' : 'MUTABLE', data);
    var entityKey = contentStateWithEntity.getLastCreatedEntityKey();
    var newEditorState = _draftJs.AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, ' ');

    return newEditorState;
  },
  insertHorizontalLine: function insertHorizontalLine(editorState) {
    return this.insertAtomicBlock(editorState, 'HR');
  },
  insertMedias: function insertMedias(editorState) {
    var medias = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];


    if (!medias.length) {
      return editorState;
    }

    if (this.getSelectionBlockType(editorState) === 'atomic') {
      this.selectNextBlock(editorState, this.getSelectionBlock(editorState));
    }

    return medias.reduce(function (editorState, media) {
      var url = media.url,
          name = media.name,
          type = media.type,
          meta = media.meta;

      var contentStateWithEntity = editorState.getCurrentContent().createEntity(type, 'IMMUTABLE', { url: url, name: name, type: type, meta: meta });
      var entityKey = contentStateWithEntity.getLastCreatedEntityKey();
      return _draftJs.AtomicBlockUtils.insertAtomicBlock(editorState, entityKey, ' ');
    }, editorState);
  },
  setMediaData: function setMediaData(editorState, entityKey, data) {
    return _draftJs.EditorState.push(editorState, editorState.getCurrentContent().mergeEntityData(entityKey, data), 'change-block-data');
  },
  removeMedia: function removeMedia(editorState, mediaBlock) {
    return this.removeBlock(editorState, mediaBlock);
  },
  setMediaPosition: function setMediaPosition(editorState, mediaBlock, position) {

    var newPosition = {};
    var float = position.float,
        alignment = position.alignment;


    if (typeof float !== 'undefined') {
      newPosition.float = mediaBlock.getData().get('float') === float ? null : float;
    }

    if (typeof alignment !== 'undefined') {
      newPosition.alignment = mediaBlock.getData().get('alignment') === alignment ? null : alignment;
    }

    return this.setSelectionBlockData(this.selectBlock(editorState, mediaBlock), newPosition);
  },
  clear: function clear(editorState) {

    var contentState = editorState.getCurrentContent();

    var firstBlock = contentState.getFirstBlock();
    var lastBlock = contentState.getLastBlock();

    var allSelected = new _draftJs.SelectionState({
      anchorKey: firstBlock.getKey(),
      anchorOffset: 0,
      focusKey: lastBlock.getKey(),
      focusOffset: lastBlock.getLength(),
      hasFocus: true
    });

    return _draftJs.EditorState.push(editorState, _draftJs.Modifier.removeRange(contentState, allSelected, 'backward'), 'remove-range');
  },
  handleKeyCommand: function handleKeyCommand(editorState, command) {
    return _draftJs.RichUtils.handleKeyCommand(editorState, command);
  },
  handleNewLine: function handleNewLine(editorState, event) {
    return (0, _draftjsUtils.handleNewLine)(editorState, event);
  },
  undo: function undo(editorState) {
    return _draftJs.EditorState.undo(editorState);
  },
  redo: function redo(editorState) {
    return _draftJs.EditorState.redo(editorState);
  }
};
//# sourceMappingURL=content.js.map