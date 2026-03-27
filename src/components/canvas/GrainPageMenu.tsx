'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  PageRecordType,
  getIndexAbove,
  getIndexBelow,
  getIndexBetween,
  IndexKey,
  TLPageId,
  releasePointerCapture,
  setPointerCapture,
  useEditor,
  useValue,
  Editor,
  TldrawUiButton,
  TldrawUiButtonCheck,
  TldrawUiButtonIcon,
  TldrawUiButtonLabel,
  TldrawUiPopover,
  TldrawUiPopoverContent,
  TldrawUiPopoverTrigger,
  TldrawUiRow,
  useBreakpoint,
  useMenuIsOpen,
  useReadonly,
  useTranslation,
  useUiEvents,
  PORTRAIT_BREAKPOINT,
  PageItemInput,
  PageItemSubmenu,
  TLUiEventHandler,
} from 'tldraw'

function onMovePage(
  editor: Editor,
  id: TLPageId,
  from: number,
  to: number,
  trackEvent: TLUiEventHandler
) {
  let index: IndexKey

  const pages = editor.getPages()
  const below = from > to ? pages[to - 1] : pages[to]
  const above = from > to ? pages[to] : pages[to + 1]

  if (below && !above) {
    index = getIndexAbove(below.index)
  } else if (!below && above) {
    index = getIndexBelow(pages[0].index)
  } else {
    index = getIndexBetween(below.index, above.index)
  }

  if (index !== pages[from].index) {
    editor.markHistoryStoppingPoint('moving page')
    editor.updatePage({ id, index })
    trackEvent('move-page', { source: 'page-menu' })
  }
}

export const GrainPageMenu = memo(function GrainPageMenu() {
  const editor = useEditor()
  const router = useRouter()
  const pathname = usePathname()
  const trackEvent = useUiEvents()
  const msg = useTranslation()
  const breakpoint = useBreakpoint()
  const [isEditing, setIsEditing] = useState(false)

  const handleOpenChange = useCallback(() => setIsEditing(false), [])
  const [isOpen, onOpenChange] = useMenuIsOpen('page-menu', handleOpenChange)

  const ITEM_HEIGHT = 36
  const rSortableContainer = useRef<HTMLDivElement>(null)

  const pages = useValue('pages', () => editor.getPages(), [editor])
  const currentPage = useValue('currentPage', () => editor.getCurrentPage(), [editor])
  const currentPageId = useValue('currentPageId', () => editor.getCurrentPageId(), [editor])
  const isReadonlyMode = useReadonly()
  const maxPageCountReached = useValue(
    'maxPageCountReached',
    () => editor.getPages().length >= editor.options.maxPages,
    [editor]
  )
  const isCoarsePointer = useValue(
    'isCoarsePointer',
    () => editor.getInstanceState().isCoarsePointer,
    [editor]
  )

  useEffect(() => {
    function handleKeyDown() {
      if (isEditing) return
      if (document.activeElement === document.body) {
        editor.menus.clearOpenMenus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, { passive: true })
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, isEditing])

  const toggleEditing = useCallback(() => {
    if (isReadonlyMode) return
    setIsEditing((s) => !s)
  }, [isReadonlyMode])

  const rMutables = useRef({
    status: 'idle' as 'idle' | 'pointing' | 'dragging',
    pointing: null as { id: string; index: number } | null,
    startY: 0,
    startIndex: 0,
    dragIndex: 0,
  })

  const [sortablePositionItems, setSortablePositionItems] = useState(
    Object.fromEntries(
      pages.map((page, i) => [page.id, { y: i * ITEM_HEIGHT, offsetY: 0, isSelected: false }])
    )
  )

  useLayoutEffect(() => {
    const animationFrame = editor.timers.requestAnimationFrame(() => {
      setSortablePositionItems(
        Object.fromEntries(
          pages.map((page, i) => [page.id, { y: i * ITEM_HEIGHT, offsetY: 0, isSelected: false }])
        )
      )
    })

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [ITEM_HEIGHT, pages])

  useEffect(() => {
    if (!isOpen) return
    editor.timers.requestAnimationFrame(() => {
      const elm = document.querySelector(`[data-pageid="${currentPageId}"]`) as HTMLDivElement | null
      if (!elm) return

      elm.querySelector('button')?.focus()
      const container = rSortableContainer.current
      if (!container) return

      const elmTopPosition = elm.offsetTop
      const containerScrollTopPosition = container.scrollTop
      if (elmTopPosition < containerScrollTopPosition) {
        container.scrollTo({ top: elmTopPosition })
      }

      const elmBottomPosition = elmTopPosition + ITEM_HEIGHT
      const containerScrollBottomPosition = container.scrollTop + container.offsetHeight
      if (elmBottomPosition > containerScrollBottomPosition) {
        container.scrollTo({ top: elmBottomPosition - container.offsetHeight })
      }
    })
  }, [ITEM_HEIGHT, currentPageId, isOpen, editor])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const { clientY, currentTarget } = e
      const { id, index } = currentTarget.dataset
      if (!id || !index) return

      const mut = rMutables.current
      setPointerCapture(e.currentTarget, e)
      mut.status = 'pointing'
      mut.pointing = { id, index: Number(index) }
      const current = sortablePositionItems[id]
      const dragY = current.y
      mut.startY = clientY
      mut.startIndex = Math.max(0, Math.min(Math.round(dragY / ITEM_HEIGHT), pages.length - 1))
    },
    [ITEM_HEIGHT, pages.length, sortablePositionItems]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const mut = rMutables.current
      if (mut.status === 'pointing') {
        const offset = e.clientY - mut.startY
        if (Math.abs(offset) > 5) mut.status = 'dragging'
      }

      if (mut.status !== 'dragging' || !mut.pointing) return

      const offsetY = e.clientY - mut.startY
      const current = sortablePositionItems[mut.pointing.id]
      const dragY = current.y + offsetY
      const dragIndex = Math.max(0, Math.min(Math.round(dragY / ITEM_HEIGHT), pages.length - 1))

      const next = { ...sortablePositionItems }
      next[mut.pointing.id] = { y: current.y, offsetY, isSelected: true }

      if (dragIndex !== mut.dragIndex) {
        mut.dragIndex = dragIndex

        for (let i = 0; i < pages.length; i++) {
          const item = pages[i]
          if (item.id === mut.pointing.id) continue

          let y = i * ITEM_HEIGHT
          if (dragIndex < mut.startIndex) {
            if (dragIndex <= i && i < mut.startIndex) y = (i + 1) * ITEM_HEIGHT
          } else if (dragIndex > mut.startIndex) {
            if (dragIndex >= i && i > mut.startIndex) y = (i - 1) * ITEM_HEIGHT
          }

          if (y !== next[item.id].y) {
            next[item.id] = { y, offsetY: 0, isSelected: true }
          }
        }
      }

      setSortablePositionItems(next)
    },
    [ITEM_HEIGHT, pages, sortablePositionItems]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const mut = rMutables.current
      if (mut.status === 'dragging' && mut.pointing) {
        onMovePage(editor, mut.pointing.id as TLPageId, mut.pointing.index, mut.dragIndex, trackEvent)
      }
      releasePointerCapture(e.currentTarget, e)
      mut.status = 'idle'
    },
    [editor, trackEvent]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'Escape') return
      const mut = rMutables.current
      if (mut.status === 'dragging') {
        setSortablePositionItems(
          Object.fromEntries(
            pages.map((page, i) => [page.id, { y: i * ITEM_HEIGHT, offsetY: 0, isSelected: false }])
          )
        )
      }
      mut.status = 'idle'
    },
    [ITEM_HEIGHT, pages]
  )

  const handleCreatePageClick = useCallback(() => {
    if (isReadonlyMode) return

    editor.run(() => {
      editor.markHistoryStoppingPoint('creating page')
      const newPageId = PageRecordType.createId()
      editor.createPage({ name: msg('page-menu.new-page-initial-name'), id: newPageId })
      editor.setCurrentPage(newPageId)
      setIsEditing(true)
    })
    trackEvent('new-page', { source: 'page-menu' })
  }, [editor, isReadonlyMode, msg, trackEvent])

  const changePage = useCallback(
    (id: TLPageId) => {
      editor.setCurrentPage(id)
      trackEvent('change-page', { source: 'page-menu' })
    },
    [editor, trackEvent]
  )

  const renamePage = useCallback(
    (id: TLPageId, name: string) => {
      editor.renamePage(id, name)
      trackEvent('rename-page', { source: 'page-menu' })
    },
    [editor, trackEvent]
  )

  const shouldUseWindowPrompt = breakpoint < PORTRAIT_BREAKPOINT.TABLET_SM && isCoarsePointer
  const isPrivateCanvas = pathname === '/canvas'
  const switchLabel = isPrivateCanvas ? 'Switch to Community Canvas' : 'Switch to Private Canvas'
  const switchHref = isPrivateCanvas ? '/' : '/canvas'
  const canvasSuffix = isPrivateCanvas ? ' - Private' : ' - Public'
  const getDisplayPageName = (name: string) => `${name}${canvasSuffix}`

  return (
    <TldrawUiPopover id="pages" onOpenChange={onOpenChange} open={isOpen}>
      <TldrawUiPopoverTrigger data-testid="main.page-menu">
        <TldrawUiButton
          type="menu"
          tooltip={getDisplayPageName(currentPage.name)}
          title={getDisplayPageName(currentPage.name)}
          data-testid="page-menu.button"
          className="tlui-page-menu__trigger"
        >
          <div className="tlui-page-menu__name">{getDisplayPageName(currentPage.name)}</div>
          <TldrawUiButtonIcon icon="chevron-down" small />
        </TldrawUiButton>
      </TldrawUiPopoverTrigger>
      <TldrawUiPopoverContent side="bottom" align="start" sideOffset={0} disableEscapeKeyDown={isEditing}>
        <div className="tlui-page-menu__wrapper">
          <div className="tlui-page-menu__header">
            <div className="tlui-page-menu__header__title">{msg('page-menu.title')}</div>
            {!isReadonlyMode && (
              <TldrawUiRow>
                <TldrawUiButton
                  type="icon"
                  data-testid="page-menu.edit"
                  tooltip={msg(isEditing ? 'page-menu.edit-done' : 'page-menu.edit-start')}
                  title={msg(isEditing ? 'page-menu.edit-done' : 'page-menu.edit-start')}
                  onClick={toggleEditing}
                >
                  <TldrawUiButtonIcon icon={isEditing ? 'check' : 'edit'} />
                </TldrawUiButton>
                <TldrawUiButton
                  type="icon"
                  data-testid="page-menu.create"
                  tooltip={msg(maxPageCountReached ? 'page-menu.max-page-count-reached' : 'page-menu.create-new-page')}
                  title={msg(maxPageCountReached ? 'page-menu.max-page-count-reached' : 'page-menu.create-new-page')}
                  disabled={maxPageCountReached}
                  onClick={handleCreatePageClick}
                >
                  <TldrawUiButtonIcon icon="plus" />
                </TldrawUiButton>
              </TldrawUiRow>
            )}
          </div>

          <div
            data-testid="page-menu.list"
            className="tlui-page-menu__list tlui-menu__group"
            style={{ height: ITEM_HEIGHT * pages.length + 4 }}
            ref={rSortableContainer}
          >
            {pages.map((page, index) => {
              const position = sortablePositionItems[page.id] ?? { y: index * ITEM_HEIGHT, offsetY: 0 }

              return isEditing ? (
                <div
                  key={page.id + '_editing'}
                  data-testid="page-menu.item"
                  data-pageid={page.id}
                  className="tlui-page_menu__item__sortable"
                  style={{
                    zIndex: page.id === currentPage.id ? 888 : index,
                    transform: `translate(0px, ${position.y + position.offsetY}px)`,
                  }}
                >
                  <TldrawUiButton
                    type="icon"
                    tabIndex={-1}
                    className="tlui-page_menu__item__sortable__handle"
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerMove={handlePointerMove}
                    onKeyDown={handleKeyDown}
                    data-id={page.id}
                    data-index={index}
                  >
                    <TldrawUiButtonIcon icon="drag-handle-dots" />
                  </TldrawUiButton>
                  {shouldUseWindowPrompt ? (
                    <TldrawUiButton
                      type="normal"
                      className="tlui-page-menu__item__button"
                      onClick={() => {
                        const name = window.prompt(msg('action.rename'), page.name)
                        if (name && name !== page.name) renamePage(page.id, name)
                      }}
                      onDoubleClick={toggleEditing}
                    >
                      <TldrawUiButtonCheck checked={page.id === currentPage.id} />
                      <TldrawUiButtonLabel>{getDisplayPageName(page.name)}</TldrawUiButtonLabel>
                    </TldrawUiButton>
                  ) : (
                    <div className="tlui-page_menu__item__sortable__title" style={{ height: ITEM_HEIGHT }}>
                      <PageItemInput
                        id={page.id}
                        name={page.name}
                        isCurrentPage={page.id === currentPage.id}
                        onComplete={() => setIsEditing(false)}
                        onCancel={() => setIsEditing(false)}
                      />
                    </div>
                  )}
                  {!isReadonlyMode && (
                    <div className="tlui-page_menu__item__submenu" data-isediting={isEditing}>
                      <PageItemSubmenu index={index} item={page} listSize={pages.length} />
                    </div>
                  )}
                </div>
              ) : (
                <div key={page.id} data-pageid={page.id} data-testid="page-menu.item" className="tlui-page-menu__item">
                  <TldrawUiButton
                    type="normal"
                    className="tlui-page-menu__item__button"
                    onClick={() => changePage(page.id)}
                    onDoubleClick={toggleEditing}
                    tooltip={msg('page-menu.go-to-page')}
                    title={msg('page-menu.go-to-page')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && page.id === currentPage.id) {
                        toggleEditing()
                        editor.markEventAsHandled(e)
                      }
                    }}
                  >
                    <TldrawUiButtonCheck checked={page.id === currentPage.id} />
                    <TldrawUiButtonLabel>{getDisplayPageName(page.name)}</TldrawUiButtonLabel>
                  </TldrawUiButton>
                  {!isReadonlyMode && (
                    <div className="tlui-page_menu__item__submenu">
                      <PageItemSubmenu
                        index={index}
                        item={page}
                        listSize={pages.length}
                        onRename={() => {
                          if (shouldUseWindowPrompt) {
                            const name = window.prompt(msg('action.rename'), page.name)
                            if (name && name !== page.name) renamePage(page.id, name)
                          } else {
                            setIsEditing(true)
                            if (currentPageId !== page.id) changePage(page.id)
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grain-page-menu__footer">
            <div className="grain-page-menu__separator" />
            <button
              type="button"
              className="grain-page-menu__switch"
              onClick={() => {
                editor.menus.clearOpenMenus()
                router.push(switchHref)
              }}
            >
              {switchLabel}
            </button>
          </div>
        </div>
      </TldrawUiPopoverContent>
    </TldrawUiPopover>
  )
})
