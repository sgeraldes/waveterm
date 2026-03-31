// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { ContextMenuModel } from "@/app/store/contextmenu";
import { makeIconClass } from "@/util/util";
import * as React from "react";
import { useRef, useState } from "react";
import {
    addCard,
    addColumn,
    clearColumnCards,
    deleteCard,
    deleteColumn,
    renameColumn,
    reorderCard,
    type KanbanCard,
    type KanbanColumn,
    type KanbanData,
} from "./kanban-util";
import "./kanban.scss";

// ---- KanbanCard component ----

type KanbanCardProps = {
    card: KanbanCard;
    columns: KanbanColumn[];
    isDragging: boolean;
    isDropTarget: boolean;
    onDragStart: (cardId: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, cardId: string) => void;
    onDrop: (targetCardId: string) => void;
    onUpdate: (cardId: string, text: string) => void;
    onDelete: (cardId: string) => void;
    onMoveToColumn: (cardId: string, colId: string) => void;
};

function KanbanCardComponent({
    card,
    columns,
    isDragging,
    isDropTarget,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
    onUpdate,
    onDelete,
    onMoveToColumn,
}: KanbanCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(card.text);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEdit = () => {
        setEditText(card.text);
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const commitEdit = () => {
        const trimmed = editText.trim();
        if (trimmed && trimmed !== card.text) {
            onUpdate(card.id, trimmed);
        }
        setIsEditing(false);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commitEdit();
        if (e.key === "Escape") setIsEditing(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const otherCols = columns.filter((c) => c.id !== card.col);
        const menuItems: ContextMenuItem[] = [
            { label: "Edit", click: () => startEdit() },
            { type: "separator" },
            ...otherCols.map((col) => ({
                label: `Move to ${col.name}`,
                click: () => onMoveToColumn(card.id, col.id),
            })),
            { type: "separator" as const },
            { label: "Delete", click: () => onDelete(card.id) },
        ];
        ContextMenuModel.showContextMenu(menuItems, e);
    };

    return (
        <>
            {isDropTarget && <div className="kanban-drop-indicator" aria-hidden="true" />}
            <div
                className={`kanban-card${isDragging ? " kanban-card-dragging" : ""}`}
                draggable
                tabIndex={0}
                role="listitem"
                aria-label={card.text}
                onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    onDragStart(card.id);
                }}
                onDragEnd={onDragEnd}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    onDragOver(e, card.id);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    onDrop(card.id);
                }}
                onContextMenu={handleContextMenu}
                onDoubleClick={startEdit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") startEdit();
                    if (e.key === "Delete" || e.key === "Backspace") {
                        if (!isEditing) onDelete(card.id);
                    }
                }}
            >
                <span
                    className="kanban-card-drag-handle"
                    aria-hidden="true"
                    title="Drag to reorder"
                >
                    <i className={makeIconClass("grip-vertical", false)} />
                </span>
                {isEditing ? (
                    <input
                        ref={inputRef}
                        className="kanban-card-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleEditKeyDown}
                        aria-label="Edit card text"
                    />
                ) : (
                    <span className="kanban-card-text">{card.text}</span>
                )}
            </div>
        </>
    );
}

// ---- KanbanColumn component ----

type KanbanColumnProps = {
    column: KanbanColumn;
    cards: KanbanCard[];
    allColumns: KanbanColumn[];
    draggingCardId: string | null;
    dropTargetCardId: string | null;
    dropTargetColId: string | null;
    onDragStart: (cardId: string) => void;
    onDragEnd: () => void;
    onCardDragOver: (e: React.DragEvent, cardId: string, colId: string) => void;
    onColDragOver: (e: React.DragEvent, colId: string) => void;
    onCardDrop: (targetCardId: string, targetColId: string) => void;
    onColDrop: (targetColId: string) => void;
    onAddCard: (colId: string, text: string) => void;
    onUpdateCard: (cardId: string, text: string) => void;
    onDeleteCard: (cardId: string) => void;
    onMoveCard: (cardId: string, colId: string) => void;
    onRename: (colId: string, newName: string) => void;
    onClearCards: (colId: string) => void;
    onDelete: (colId: string) => void;
};

function KanbanColumnComponent({
    column,
    cards,
    allColumns,
    draggingCardId,
    dropTargetCardId,
    dropTargetColId,
    onDragStart,
    onDragEnd,
    onCardDragOver,
    onColDragOver,
    onCardDrop,
    onColDrop,
    onAddCard,
    onUpdateCard,
    onDeleteCard,
    onMoveCard,
    onRename,
    onClearCards,
    onDelete,
}: KanbanColumnProps) {
    const [addText, setAddText] = useState("");
    const [isRenamingHeader, setIsRenamingHeader] = useState(false);
    const [renameText, setRenameText] = useState(column.name);
    const headerInputRef = useRef<HTMLInputElement>(null);

    const sortedCards = [...cards].sort((a, b) => a.order - b.order);
    const isColDropTarget = dropTargetColId === column.id && dropTargetCardId === null;

    const commitRename = () => {
        const trimmed = renameText.trim();
        if (trimmed && trimmed !== column.name) {
            onRename(column.id, trimmed);
        }
        setIsRenamingHeader(false);
    };

    const startRename = () => {
        setRenameText(column.name);
        setIsRenamingHeader(true);
        setTimeout(() => headerInputRef.current?.focus(), 0);
    };

    const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") setIsRenamingHeader(false);
    };

    const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && addText.trim()) {
            onAddCard(column.id, addText);
            setAddText("");
        }
        if (e.key === "Escape") setAddText("");
    };

    const handleMenuClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        const menuItems: ContextMenuItem[] = [
            { label: "Rename", click: () => startRename() },
            {
                label: "Clear All Cards",
                click: () => onClearCards(column.id),
            },
            { type: "separator" },
            { label: "Delete Column", click: () => onDelete(column.id) },
        ];
        ContextMenuModel.showContextMenu(menuItems, e);
    };

    return (
        <div
            className={`kanban-column${isColDropTarget ? " kanban-column-drag-over" : ""}`}
            role="group"
            aria-label={`${column.name} column, ${cards.length} cards`}
            onDragOver={(e) => {
                e.preventDefault();
                onColDragOver(e, column.id);
            }}
            onDrop={(e) => {
                e.preventDefault();
                onColDrop(column.id);
            }}
        >
            <div className="kanban-column-header">
                {isRenamingHeader ? (
                    <input
                        ref={headerInputRef}
                        className="kanban-column-name"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={handleHeaderKeyDown}
                        aria-label="Rename column"
                    />
                ) : (
                    <input
                        className="kanban-column-name"
                        value={column.name}
                        readOnly
                        tabIndex={0}
                        onDoubleClick={startRename}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "F2") startRename();
                        }}
                        aria-label={`Column name: ${column.name}`}
                    />
                )}
                <span className="kanban-column-count" aria-hidden="true">
                    {cards.length}
                </span>
                <button
                    className="kanban-column-menu-btn"
                    title="Column options"
                    onClick={handleMenuClick}
                    aria-label={`${column.name} column options`}
                >
                    <i className={makeIconClass("ellipsis", false)} />
                </button>
            </div>

            <div
                className="kanban-cards"
                role="list"
                aria-label={`Cards in ${column.name}`}
            >
                {sortedCards.map((card) => (
                    <KanbanCardComponent
                        key={card.id}
                        card={card}
                        columns={allColumns}
                        isDragging={draggingCardId === card.id}
                        isDropTarget={dropTargetCardId === card.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDragOver={(e, cardId) => onCardDragOver(e, cardId, column.id)}
                        onDrop={(targetCardId) => onCardDrop(targetCardId, column.id)}
                        onUpdate={onUpdateCard}
                        onDelete={onDeleteCard}
                        onMoveToColumn={onMoveCard}
                    />
                ))}
                {/* Drop indicator at bottom of column when column is target with no card target */}
                {isColDropTarget && <div className="kanban-drop-indicator" aria-hidden="true" />}
            </div>

            <div className="kanban-add-card">
                <i className={makeIconClass("plus", false)} aria-hidden="true" />
                <input
                    type="text"
                    placeholder="Add a card..."
                    value={addText}
                    onChange={(e) => setAddText(e.target.value)}
                    onKeyDown={handleAddKeyDown}
                    aria-label={`Add card to ${column.name}`}
                />
            </div>
        </div>
    );
}

// ---- KanbanBoard ----

type KanbanBoardProps = {
    data: KanbanData;
    onChange: (data: KanbanData) => void;
};

export function KanbanBoard({ data, onChange }: KanbanBoardProps) {
    const draggingCardId = useRef<string | null>(null);
    const [draggingCardIdState, setDraggingCardIdState] = useState<string | null>(null);
    const [dropTargetCardId, setDropTargetCardId] = useState<string | null>(null);
    const [dropTargetColId, setDropTargetColId] = useState<string | null>(null);

    const sortedColumns = [...data.columns].sort((a, b) => a.order - b.order);

    const handleDragStart = (cardId: string) => {
        draggingCardId.current = cardId;
        setDraggingCardIdState(cardId);
    };

    const handleDragEnd = () => {
        draggingCardId.current = null;
        setDraggingCardIdState(null);
        setDropTargetCardId(null);
        setDropTargetColId(null);
    };

    const handleCardDragOver = (_e: React.DragEvent, cardId: string, colId: string) => {
        if (draggingCardId.current === cardId) return;
        setDropTargetCardId(cardId);
        setDropTargetColId(colId);
    };

    const handleColDragOver = (_e: React.DragEvent, colId: string) => {
        setDropTargetColId(colId);
        setDropTargetCardId(null);
    };

    const handleCardDrop = (targetCardId: string, targetColId: string) => {
        const srcId = draggingCardId.current;
        if (!srcId) return;
        const updated = reorderCard(data, srcId, targetColId, targetCardId);
        onChange(updated);
        handleDragEnd();
    };

    const handleColDrop = (targetColId: string) => {
        const srcId = draggingCardId.current;
        if (!srcId) return;
        const updated = reorderCard(data, srcId, targetColId, null);
        onChange(updated);
        handleDragEnd();
    };

    const handleAddCard = (colId: string, text: string) => {
        onChange(addCard(data, colId, text));
    };

    const handleUpdateCard = (cardId: string, text: string) => {
        onChange(
            data.cards.find((c) => c.id === cardId)
                ? { ...data, cards: data.cards.map((c) => (c.id === cardId ? { ...c, text } : c)) }
                : data
        );
    };

    const handleDeleteCard = (cardId: string) => {
        onChange(deleteCard(data, cardId));
    };

    const handleMoveCard = (cardId: string, colId: string) => {
        onChange(reorderCard(data, cardId, colId, null));
    };

    const handleRenameColumn = (colId: string, newName: string) => {
        onChange(renameColumn(data, colId, newName));
    };

    const handleClearColumn = (colId: string) => {
        onChange(clearColumnCards(data, colId));
    };

    const handleDeleteColumn = (colId: string) => {
        onChange(deleteColumn(data, colId));
    };

    const handleAddColumn = () => {
        onChange(addColumn(data, "New Column"));
    };

    return (
        <div className="kanban-board" role="main" aria-label="Kanban board">
            {sortedColumns.map((col) => (
                <KanbanColumnComponent
                    key={col.id}
                    column={col}
                    cards={data.cards.filter((c) => c.col === col.id)}
                    allColumns={sortedColumns}
                    draggingCardId={draggingCardIdState}
                    dropTargetCardId={dropTargetCardId}
                    dropTargetColId={dropTargetColId}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onCardDragOver={handleCardDragOver}
                    onColDragOver={handleColDragOver}
                    onCardDrop={handleCardDrop}
                    onColDrop={handleColDrop}
                    onAddCard={handleAddCard}
                    onUpdateCard={handleUpdateCard}
                    onDeleteCard={handleDeleteCard}
                    onMoveCard={handleMoveCard}
                    onRename={handleRenameColumn}
                    onClearCards={handleClearColumn}
                    onDelete={handleDeleteColumn}
                />
            ))}
            <button
                className="kanban-ghost-column"
                onClick={handleAddColumn}
                title="Add column"
                aria-label="Add new column"
            >
                <i className={makeIconClass("plus", false)} />
            </button>
        </div>
    );
}
