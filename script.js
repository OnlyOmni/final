// --- START OF FILE script.js ---

// --- Piece-Square Tables (Global within this script) ---
const pawnTable = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];
const knightTable = [
    [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,  0,  5,  5,  0,-20,-40],[-30,  5, 10, 15, 15, 10,  5,-30],[-30,  0, 15, 20, 20, 15,  0,-30],[-30,  5, 15, 20, 20, 15,  5,-30],[-30,  0, 10, 15, 15, 10,  0,-30],[-40,-20,  0,  0,  0,  0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];
const bishopTable = [
    [-20,-10,-10,-10,-10,-10,-10,-20],[-10,  0,  0,  0,  0,  0,  0,-10],[-10,  0,  5, 10, 10,  5,  0,-10],[-10,  5,  5, 10, 10,  5,  5,-10],[-10,  0, 10, 10, 10, 10,  0,-10],[-10, 10, 10, 10, 10, 10, 10,-10],[-10,  5,  0,  0,  0,  0,  5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
];
const rookTable = [
    [0,  0,  0,  5,  5,  0,  0,  0],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[5, 10, 10, 10, 10, 10, 10,  5],[0,  0,  0,  0,  0,  0,  0,  0]
];
const queenTable = [
    [-20,-10,-10, -5, -5,-10,-10,-20],[-10,  0,  5,  0,  0,  0,  0,-10],[-10,  5,  5,  5,  5,  5,  0,-10],[0,  0,  5,  5,  5,  5,  0, -5],[-5,  0,  5,  5,  5,  5,  0, -5],[-10,  0,  5,  5,  5,  5,  0,-10],[-10,  0,  0,  0,  0,  0,  0,-10],[-20,-10,-10, -5, -5,-10,-10,-20]
];
const kingTableEarly = [
    [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20, 20,  0,  0,  0,  0, 20, 20],[20, 30, 10,  0,  0, 10, 30, 20]
];
const kingTableEnd = [
    [-50,-40,-30,-20,-20,-30,-40,-50],[-30,-20,-10,  0,  0,-10,-20,-30],[-30,-10, 20, 30, 30, 20,-10,-30],[-30,-10, 30, 40, 40, 30,-10,-30],[-30,-10, 30, 40, 40, 30,-10,-30],[-30,-10, 20, 30, 30, 20,-10,-30],[-30,-30,  0,  0,  0,  0,-30,-30],[-50,-30,-30,-30,-30,-30,-30,-50]
];
const pieceValuesBase = { 'p': 100, 'n': 320, 'b': 330, 'r': 500, 'q': 900, 'k': 20000 };

function getPieceSquareValue(piece, squareName, currentGame) {
    if (!piece || !currentGame) return 0;
    const file = squareName.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(squareName.charAt(1));
    if (rank < 0 || rank > 7 || file < 0 || file > 7) return 0;
    let table;
    switch (piece.type) {
        case 'p': table = pawnTable; break;
        case 'n': table = knightTable; break;
        case 'b': table = bishopTable; break;
        case 'r': table = rookTable; break;
        case 'q': table = queenTable; break;
        case 'k':
            const boardFenPieces = currentGame.fen().split(' ')[0];
            const allPiecesString = boardFenPieces.replace(/\//g, '').replace(/[1-8]/g, '');
            const pieceCount = allPiecesString.length;
            const queenCount = (allPiecesString.match(/q/gi) || []).length;
            table = (pieceCount < 12 || queenCount < 2) ? kingTableEnd : kingTableEarly;
            break;
        default: return 0;
    }
    return (piece.color === 'w') ? table[rank][file] : -table[7 - rank][file];
}

const AI_SEARCH_DEPTH = 2;
const AI_ENDGAME_SEARCH_DEPTH = 3;
const ENDGAME_NON_PAWN_KING_PIECE_THRESHOLD = 5;
const MATE_SCORE = 1000000;
const ABSOLUTE_INFINITY = MATE_SCORE * 10;
const QUIESCENCE_MAX_DEPTH = 2;

// --- Global variables for draw/concession states ---
let gameEndedManually = false;
let gameEndReason = '';
let playerOfferedDrawPendingAIResponse = false;
let aiOfferedDrawPendingPlayerResponse = false;
let aiOfferedDrawMoveSAN = null; // Stores the move AI would make if player declines its draw offer

const AI_OFFERS_DRAW_SCORE_THRESHOLD = 20; // Centipawns (e.g. +/- 0.2 pawns). AI offers draw if its best move leads to eval within this from 0.
const MIN_MOVES_FOR_AI_DRAW_OFFER = 10 * 2; // AI won't offer draw before 10 full moves (20 half-moves).
const AI_ACCEPTS_PLAYER_DRAW_OFFER_THRESHOLD = 50; // AI accepts player's draw offer if AI's current eval is below this (i.e., not clearly winning).


function isEndgamePhaseForSearch(gameState) {
    if (!gameState) return false;
    const boardFenPieces = gameState.fen().split(' ')[0];
    const allPiecesString = boardFenPieces.replace(/\//g, '').replace(/[1-8]/g, '');
    const numNonPawnNonKingPieces = allPiecesString.replace(/[pkPK]/g, '').length;
    return numNonPawnNonKingPieces <= ENDGAME_NON_PAWN_KING_PIECE_THRESHOLD;
}

function evaluateBoard(current_game_state, ai_color_perspective) {
    let totalEvaluation = 0;
    const mobilityFactor = 1;
    const doubledPawnPenalty = 10;
    const isolatedPawnPenalty = 12;
    const passedPawnBonusByWhiteRankIdx = [0, 100, 75, 50, 30, 15, 5, 0];
    const rookOnOpenFileBonus = 15;
    const rookOnSemiOpenFileBonus = 8;
    const rookOnSeventhRankBonus = 25;

    let whitePawnsOnFiles = Array(8).fill(0);
    let blackPawnsOnFiles = Array(8).fill(0);
    let whitePawnRanksByFile = [[], [], [], [], [], [], [], []];
    let blackPawnRanksByFile = [[], [], [], [], [], [], [], []];

    for (let r_scan = 0; r_scan < 8; r_scan++) {
        for (let f_scan = 0; f_scan < 8; f_scan++) {
            const piece_scan = current_game_state.get('abcdefgh'[f_scan] + (8 - r_scan));
            if (piece_scan && piece_scan.type === 'p') {
                if (piece_scan.color === 'w') {
                    whitePawnsOnFiles[f_scan]++;
                    if (Array.isArray(whitePawnRanksByFile[f_scan])) {
                        whitePawnRanksByFile[f_scan].push(r_scan);
                    } else {
                        console.error("CRITICAL: whitePawnRanksByFile[" + f_scan + "] is not an array during population!");
                        whitePawnRanksByFile[f_scan] = [r_scan];
                    }
                } else {
                    blackPawnsOnFiles[f_scan]++;
                    if (Array.isArray(blackPawnRanksByFile[f_scan])) {
                        blackPawnRanksByFile[f_scan].push(r_scan);
                    } else {
                        console.error("CRITICAL: blackPawnRanksByFile[" + f_scan + "] is not an array during population!");
                        blackPawnRanksByFile[f_scan] = [r_scan];
                    }
                }
            }
        }
    }

    for (let r_idx = 0; r_idx < 8; r_idx++) {
        for (let f_idx = 0; f_idx < 8; f_idx++) {
            const squareName = 'abcdefgh'[f_idx] + (8 - r_idx);
            const piece = current_game_state.get(squareName);
            if (piece) {
                let piece_value = pieceValuesBase[piece.type] + getPieceSquareValue(piece, squareName, current_game_state);
                let positional_bonus = 0;
                if (piece.type === 'p') {
                    if (piece.color === 'w' && whitePawnsOnFiles[f_idx] > 1) positional_bonus -= doubledPawnPenalty;
                    if (piece.color === 'b' && blackPawnsOnFiles[f_idx] > 1) positional_bonus -= doubledPawnPenalty;
                    let isIsolated = true;
                    const friendlyPawns = piece.color === 'w' ? whitePawnsOnFiles : blackPawnsOnFiles;
                    if (f_idx > 0 && friendlyPawns[f_idx - 1] > 0) isIsolated = false;
                    if (f_idx < 7 && friendlyPawns[f_idx + 1] > 0) isIsolated = false;
                    if (isIsolated) positional_bonus -= isolatedPawnPenalty;
                    let isPassed = true;
                    const enemyPawnRanksToCheck = piece.color === 'w' ? blackPawnRanksByFile : whitePawnRanksByFile;
                    for (let check_f = f_idx - 1; check_f <= f_idx + 1; check_f++) {
                        if (check_f < 0 || check_f > 7) continue;
                        if (Array.isArray(enemyPawnRanksToCheck[check_f])) {
                            for (const enemyPawnRank of enemyPawnRanksToCheck[check_f]) {
                                if (piece.color === 'w' && enemyPawnRank < r_idx) { isPassed = false; break; }
                                if (piece.color === 'b' && enemyPawnRank > r_idx) { isPassed = false; break; }
                            }
                        } else {
                             console.warn("WARN: enemyPawnRanksToCheck[" + check_f + "] was not an array in passed pawn check.");
                        }
                        if (!isPassed) break;
                    }
                    if (isPassed) {
                        positional_bonus += (piece.color === 'w') ? passedPawnBonusByWhiteRankIdx[r_idx]
                                                                 : passedPawnBonusByWhiteRankIdx[7 - r_idx];
                    }
                } else if (piece.type === 'r') {
                    const friendlyPawnsOnThisFile = (piece.color === 'w') ? whitePawnsOnFiles[f_idx] : blackPawnsOnFiles[f_idx];
                    const enemyPawnsOnThisFile    = (piece.color === 'w') ? blackPawnsOnFiles[f_idx] : whitePawnsOnFiles[f_idx];
                    if (friendlyPawnsOnThisFile === 0) {
                        if (enemyPawnsOnThisFile === 0) positional_bonus += rookOnOpenFileBonus;
                        else positional_bonus += rookOnSemiOpenFileBonus;
                    }
                    if ((piece.color === 'w' && r_idx === 1) || (piece.color === 'b' && r_idx === 6)) {
                        positional_bonus += rookOnSeventhRankBonus;
                    }
                }
                piece_value += positional_bonus;
                totalEvaluation += (piece.color === ai_color_perspective ? piece_value : -piece_value);
            }
        }
    }
    const turn_player = current_game_state.turn();
    const legal_moves_for_turn_player = current_game_state.moves();
    let mobility_score = legal_moves_for_turn_player.length * mobilityFactor;
    totalEvaluation += (turn_player === ai_color_perspective ? mobility_score : -mobility_score);
    if (current_game_state.in_check()) {
        if (turn_player !== ai_color_perspective) totalEvaluation += 35; // Opponent is in check
        // else: AI is in check, this is generally bad, but mobility reduction might cover it.
        // Could add a penalty if turn_player === ai_color_perspective and in_check.
    }
    return totalEvaluation;
}

function quiescenceSearch(gameState, alpha, beta, aiColorPerspective, currentQuiescenceDepth) {
    const originalFenForDebug = gameState.fen();
    if (gameState.in_checkmate()) {
        return (gameState.turn() === aiColorPerspective) ? -MATE_SCORE + currentQuiescenceDepth * 10 : MATE_SCORE - currentQuiescenceDepth * 10;
    }
    if (gameState.in_draw() || gameState.in_stalemate() || gameState.insufficient_material()) {
        return 0;
    }
    let standPatScore = evaluateBoard(gameState, aiColorPerspective);
    // Score from negamax perspective (current player to move)
    if (gameState.turn() !== aiColorPerspective) standPatScore = -standPatScore;


    if (currentQuiescenceDepth >= QUIESCENCE_MAX_DEPTH) {
        return standPatScore;
    }
    if (standPatScore >= beta) return beta;
    if (standPatScore > alpha) alpha = standPatScore;

    let movesToConsider = [];
    const allMoves = gameState.moves({ verbose: true });
    if (gameState.in_check()) { // If in check, all evasions must be considered
        if (currentQuiescenceDepth < QUIESCENCE_MAX_DEPTH) { // Only if not at max depth for check evasions
             movesToConsider = allMoves;
        } else {
            return standPatScore; // At max depth and in check, return eval
        }
    } else { // Not in check, only consider captures and promotions
        movesToConsider = allMoves.filter(move => move.captured || move.promotion);
    }
    movesToConsider.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.promotion) scoreA += (pieceValuesBase[a.promotion] || pieceValuesBase['q']) * 10;
        if (a.captured) {
            const victimPiece = pieceValuesBase[a.captured] || 0;
            const attackerPiece = pieceValuesBase[gameState.get(a.from)?.type] || 0;
            scoreA += victimPiece * 10 - attackerPiece; // MVV-LVA
        }
        if (b.promotion) scoreB += (pieceValuesBase[b.promotion] || pieceValuesBase['q']) * 10;
        if (b.captured) {
            const victimPiece = pieceValuesBase[b.captured] || 0;
            const attackerPiece = pieceValuesBase[gameState.get(b.from)?.type] || 0;
            scoreB += victimPiece * 10 - attackerPiece; // MVV-LVA
        }
        return scoreB - scoreA;
    });

    for (const move of movesToConsider) {
        const moveResult = gameState.move(move.san);
        if (!moveResult) {
            console.warn(`Quiescence: chess.js failed to make move ${move.san} from FEN ${originalFenForDebug}. Skipping.`);
            continue;
        }
        let score = -quiescenceSearch(gameState, -beta, -alpha, aiColorPerspective, currentQuiescenceDepth + 1);
        const undoResult = gameState.undo();
        if (!undoResult) {
            console.error(`Quiescence: CRITICAL - Failed to undo move ${move.san}. FEN: ${originalFenForDebug}. Attempting restore.`);
            gameState.load(originalFenForDebug); // Attempt to restore from FEN
            return alpha; // Might be unstable, but better than crashing
        }
        if (score >= beta) return beta; // Fail-hard beta cutoff
        if (score > alpha) alpha = score; // New best move
    }
    return alpha;
}

function negamax(gameState, currentPly, maxPlyToReach, alpha, beta, aiColorPerspective) {
    const originalFenForDebug = gameState.fen();
    if (currentPly > 0 && gameState.in_checkmate()) { // Checkmate found at this node
        return -MATE_SCORE + currentPly * 10; // Penalize deeper mates slightly
    }
    if (currentPly > 0 && (gameState.in_draw() || gameState.in_stalemate() || gameState.insufficient_material())) {
        return 0; // Draw
    }
    if (currentPly === maxPlyToReach) { // Depth limit reached
        return quiescenceSearch(gameState, alpha, beta, aiColorPerspective, 0);
    }

    let maxEval = -ABSOLUTE_INFINITY;
    const moves = gameState.moves({ verbose: true });

    if (moves.length === 0) { // No legal moves
        if (gameState.in_checkmate()) return -MATE_SCORE + currentPly * 10; // Checkmated
        return 0; // Stalemate
    }

    // Move ordering (simple: captures, promotions, checks first)
    moves.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.captured) scoreA += 100 + (pieceValuesBase[a.captured] || 0);
        if (a.promotion) scoreA += (pieceValuesBase[a.promotion || 'q'] || pieceValuesBase['q']) * 10;
        if (a.san.includes('+') || a.san.includes('#')) scoreA += 5; // Check or checkmate hint

        if (b.captured) scoreB += 100 + (pieceValuesBase[b.captured] || 0);
        if (b.promotion) scoreB += (pieceValuesBase[b.promotion || 'q'] || pieceValuesBase['q']) * 10;
        if (b.san.includes('+') || b.san.includes('#')) scoreB += 5;
        return scoreB - scoreA;
    });

    for (const move of moves) {
        const moveResult = gameState.move(move.san);
        if (!moveResult) {
            console.error(`Negamax: chess.js failed to make move ${move.san} from FEN ${originalFenForDebug}. Skipping.`);
            continue;
        }
        let currentEval = -negamax(gameState, currentPly + 1, maxPlyToReach, -beta, -alpha, aiColorPerspective);
        const undoResult = gameState.undo();
        if (!undoResult) {
            console.error(`Negamax: CRITICAL - Failed to undo move ${move.san}. FEN: ${originalFenForDebug}. Attempting restore.`);
            gameState.load(originalFenForDebug);
            return -ABSOLUTE_INFINITY; // Or some other error indicator
        }

        if (currentEval > maxEval) maxEval = currentEval;
        alpha = Math.max(alpha, currentEval);
        if (alpha >= beta) break; // Beta cutoff
    }
    return maxEval;
}

function getBestMoveAI(currentGame) {
    if (!currentGame || currentGame.game_over() || gameEndedManually) return null;
    const aiColor = currentGame.turn();
    const possibleMoves = currentGame.moves({ verbose: true });
    if (possibleMoves.length === 0) return null;

    let bestMoveSAN = null;
    let bestScore = -ABSOLUTE_INFINITY;
    const isEndgame = isEndgamePhaseForSearch(currentGame);
    const currentSearchDepth = isEndgame && AI_ENDGAME_SEARCH_DEPTH > AI_SEARCH_DEPTH ? AI_ENDGAME_SEARCH_DEPTH : AI_SEARCH_DEPTH;

    if(isEndgame && currentSearchDepth > AI_SEARCH_DEPTH) {
        console.log(`[AI] Endgame detected. Using deeper fixed search depth: ${currentSearchDepth} (Quiescence up to +${QUIESCENCE_MAX_DEPTH})`);
    }

    possibleMoves.sort((a, b) => {
        let scoreA = 0, scoreB = 0;
        if (a.promotion) scoreA += (pieceValuesBase[a.promotion] || pieceValuesBase['q']) * 100;
        if (a.captured) scoreA += (pieceValuesBase[a.captured] || 0) * 10 - (pieceValuesBase[currentGame.get(a.from)?.type] || 0);
        if (a.san.includes('+') || a.san.includes('#')) scoreA += 5;
        if (b.promotion) scoreB += (pieceValuesBase[b.promotion] || pieceValuesBase['q']) * 100;
        if (b.captured) scoreB += (pieceValuesBase[b.captured] || 0) * 10 - (pieceValuesBase[currentGame.get(b.from)?.type] || 0);
        if (b.san.includes('+') || b.san.includes('#')) scoreB += 5;
        return scoreB - scoreA;
    });

    for (let i = 0; i < possibleMoves.length; i++) {
        const move = possibleMoves[i];
        const fenBeforeMove = currentGame.fen();
        const moveResult = currentGame.move(move.san);
        if (!moveResult) {
            console.error(`[AI getBestMoveAI] Top-Level: chess.js failed to make move: ${move.san} from FEN ${fenBeforeMove}. Skipping.`);
            continue;
        }

        if (currentGame.in_checkmate()) { // Immediate checkmate found
            currentGame.undo();
            console.log(`[AI getBestMoveAI] Found immediate checkmate: ${move.san}`);
            return { san: move.san, score: MATE_SCORE, offerDraw: false };
        }

        let currentMoveScore = -negamax(currentGame, 1, currentSearchDepth, -ABSOLUTE_INFINITY, ABSOLUTE_INFINITY, aiColor);
        const undoSuccessful = currentGame.undo();
        if (!undoSuccessful) {
            console.error(`[AI getBestMoveAI] Top-Level CRITICAL: Failed to undo move ${move.san}. Original FEN: ${fenBeforeMove}. Restoring FEN.`);
            currentGame.load(fenBeforeMove); // Attempt to restore
            continue; // Skip this move evaluation
        }

        if (currentMoveScore > bestScore) {
            bestScore = currentMoveScore;
            bestMoveSAN = move.san;
        } else if (currentMoveScore === bestScore && (Math.random() < 0.10)) { // Small chance to pick an equally good move
            bestMoveSAN = move.san;
        }
    }

    let offerDrawSignal = false;
    if (bestMoveSAN &&
        !currentGame.in_checkmate() && // Should be covered by bestScore check
        !currentGame.in_draw() && // Don't offer if game is already a rule-based draw
        Math.abs(bestScore) < AI_OFFERS_DRAW_SCORE_THRESHOLD &&
        currentGame.history().length >= MIN_MOVES_FOR_AI_DRAW_OFFER &&
        bestScore < (MATE_SCORE - 1000) && bestScore > (-MATE_SCORE + 1000) // Not in a clear mating sequence
       ) {
        offerDrawSignal = true;
        console.log(`[AI getBestMoveAI] Considering offering a draw. Best move ${bestMoveSAN} leads to score: ${bestScore.toFixed(0)}`);
    }

    if (bestMoveSAN === null && possibleMoves.length > 0) {
        bestMoveSAN = possibleMoves[0].san; // Fallback to the best pre-sorted move
        bestScore = -ABSOLUTE_INFINITY; // Indicate it's a fallback score
        console.warn(`[AI getBestMoveAI] No clear best move from search, picking best sorted: ${bestMoveSAN}`);
    } else if (bestMoveSAN) {
         console.log(`[AI getBestMoveAI] Chosen move: ${bestMoveSAN} with score: ${bestScore.toFixed(0)} (Fixed Depth: ${currentSearchDepth}, Quiescence: +${QUIESCENCE_MAX_DEPTH})${offerDrawSignal ? " (with draw offer)" : ""}`);
    } else if (possibleMoves.length === 0) {
        console.log("[AI getBestMoveAI] No possible moves for AI.");
         return null;
    } else { // Should not be reached if possibleMoves.length > 0
        console.error("[AI getBestMoveAI] CRITICAL: No move selected despite available moves. Picking first sorted.");
        bestMoveSAN = possibleMoves[0].san;
        bestScore = -ABSOLUTE_INFINITY;
    }

    return bestMoveSAN ? { san: bestMoveSAN, score: bestScore, offerDraw: offerDrawSignal } : null;
}


$(document).ready(function() {
    console.log("Document ready. Main script.js executing with CLICK-ONLY movement.");
    const statusEl = $('#status');
    const turnEl = $('#turn');
    const fenEl = $('#fen');
    const pgnEl = $('#pgn');
    const playerColorSelect = $('#playerColor');
    const newGameButton = $('#newGameButton');
    const undoButton = $('#undoButton');
    const offerDrawButton = $('#offerDrawButton'); // New
    const concedeButton = $('#concedeButton');     // New
    const aiDrawOfferControls = $('#aiDrawOfferControls'); // New
    const acceptAIDrawButton = $('#acceptAIDrawButton');   // New
    const declineAIDrawButton = $('#declineAIDrawButton'); // New

    let board = null;
    let game = null;
    let playerChoosesColor = 'w';
    let actualPlayerColor = 'w';
    let playerOrientation = 'white';
    let aiIsThinking = false;
    let selectedSquare = null;
    let $liftedPieceElement = null;

    function clearPieceLift() { if ($liftedPieceElement) { $liftedPieceElement.removeClass('piece-lifted'); $liftedPieceElement = null; } }
    function applyPieceLift(squareName) {
        clearPieceLift();
        const $pieceImage = $('#board .square-55d63[data-square="' + squareName + '"] img');
        if ($pieceImage.length) { $pieceImage.addClass('piece-lifted'); $liftedPieceElement = $pieceImage; }
    }
    function clearBoardHighlights() { $('#board .square-55d63').removeClass('highlight-selected highlight-legal highlight-capture'); }
    function clearMoveHighlights() { $('#board .square-55d63').removeClass('highlight-legal highlight-capture'); }

    function highlightLegalMoves(square) {
        clearMoveHighlights();
        if (!game) return;
        const moves = game.moves({ square: square, verbose: true });
        if (moves.length === 0) return;
        moves.forEach(move => {
            const $targetSquare = $('#board .square-55d63[data-square="' + move.to + '"]');
            if (move.captured) { $targetSquare.addClass('highlight-capture'); } else { $targetSquare.addClass('highlight-legal'); }
        });
    }

    async function makeAIMove() {
        if (!game || game.game_over() || gameEndedManually || game.turn() === actualPlayerColor) {
            aiIsThinking = false;
            updateStatus();
            return;
        }
        aiIsThinking = true;
        const isEndgameForSearch = isEndgamePhaseForSearch(game);
        const usingDeeperFixedSearch = isEndgameForSearch && AI_ENDGAME_SEARCH_DEPTH > AI_SEARCH_DEPTH;
        statusEl.text(`OmniBot (Enhanced AI) is thinking${usingDeeperFixedSearch ? " (deep search)..." : "..."}`);
        updateStatus(); // To disable buttons while AI thinks initially
        await new Promise(resolve => setTimeout(resolve, 50));

        const aiDecision = getBestMoveAI(game);

        if (aiDecision && aiDecision.offerDraw) {
            aiOfferedDrawPendingPlayerResponse = true;
            aiOfferedDrawMoveSAN = aiDecision.san;
            aiDrawOfferControls.find('span').text(`AI offers a draw (eval: ${aiDecision.score.toFixed(0)}). Accept?`);
            aiDrawOfferControls.show();
            // aiIsThinking remains true while waiting for player
            updateStatus();
            return;
        }

        const moveSAN = aiDecision ? (typeof aiDecision === 'string' ? aiDecision : aiDecision.san) : null;

        if (moveSAN) {
            const moveResult = game.move(moveSAN);
            if (moveResult) {
                if (board) board.position(game.fen());
                playSound('move-opponent');
                if (game.in_check()) playSound('check');
            } else {
                console.error("[AI makeAIMove] ERROR: chess.js rejected AI's chosen move:", moveSAN, "Current FEN:", game.fen(), "Legal moves:", game.moves());
                const fallbackMoves = game.moves();
                if (fallbackMoves.length > 0) {
                    const randomFallback = fallbackMoves[Math.floor(Math.random() * fallbackMoves.length)];
                    game.move(randomFallback);
                    if (board) board.position(game.fen());
                    playSound('move-opponent'); console.warn("[AI makeAIMove] Made a random fallback move:", randomFallback);
                } else { console.error("[AI makeAIMove] No fallback moves available after AI error."); }
            }
        } else {
            console.warn("[AI makeAIMove] getBestMoveAI returned null or no SAN. No move made.");
            if (!game.game_over() && !gameEndedManually && game.moves().length > 0) {
                 console.error("[AI makeAIMove] CRITICAL: AI failed to produce a move in a non-terminal state with legal moves.");
            }
        }
        aiIsThinking = false;
        updateStatus();
    }

    function playSound(type) {
        const sounds = { 'move-self': document.getElementById('moveSound'), 'move-opponent': document.getElementById('moveSound'), 'capture': document.getElementById('captureSound'), 'game-start': document.getElementById('notifySound'), 'undo': document.getElementById('notifySound'), 'check': document.getElementById('notifySound') };
        try { if (sounds[type] && typeof sounds[type].play === 'function') { sounds[type].currentTime = 0; sounds[type].play().catch(e => console.warn("Sound play failed for", type, ":", e)); }
        } catch (e) { console.warn("Error playing sound type", type, ":", e); }
    }

    function handleSquareClick(squareName) {
        if (!game || game.game_over() || gameEndedManually || game.turn() !== actualPlayerColor || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse ) {
            if (selectedSquare) { clearPieceLift(); clearBoardHighlights(); selectedSquare = null; }
            return;
        }
        const pieceOnClickedSquare = game.get(squareName);
        const $clickedSquareElement = $('#board .square-55d63[data-square="' + squareName + '"]');
        if (!selectedSquare) {
            if (pieceOnClickedSquare && pieceOnClickedSquare.color === actualPlayerColor) {
                clearBoardHighlights(); selectedSquare = squareName; $clickedSquareElement.addClass('highlight-selected'); applyPieceLift(selectedSquare); highlightLegalMoves(selectedSquare);
            } else { clearPieceLift(); clearBoardHighlights(); selectedSquare = null; }
        } else {
            if (squareName === selectedSquare) { clearPieceLift(); clearBoardHighlights(); selectedSquare = null; }
            else {
                const moves = game.moves({ square: selectedSquare, verbose: true });
                const legalMoveToTarget = moves.find(m => m.to === squareName);
                if (legalMoveToTarget) {
                    const moveAttempt = { from: selectedSquare, to: squareName, promotion: 'q' }; // Default promotion to queen
                    const moveResult = game.move(moveAttempt);
                    if (moveResult) {
                        playSound(moveResult.captured ? 'capture' : 'move-self'); if (game.in_check()) playSound('check');
                        clearPieceLift(); clearBoardHighlights(); selectedSquare = null;
                        if (board) board.position(game.fen()); updateStatus();
                        if (!game.game_over() && !gameEndedManually && game.turn() !== actualPlayerColor && !aiIsThinking) { makeAIMove(); }
                    } else { console.error("[handleSquareClick] CRITICAL: Move failed by game.move() despite verbose check.", moveAttempt); clearPieceLift(); clearBoardHighlights(); selectedSquare = null; }
                } else {
                    if (pieceOnClickedSquare && pieceOnClickedSquare.color === actualPlayerColor) {
                        clearPieceLift(); clearBoardHighlights(); selectedSquare = squareName; $clickedSquareElement.addClass('highlight-selected'); applyPieceLift(selectedSquare); highlightLegalMoves(selectedSquare);
                    } else { clearPieceLift(); clearBoardHighlights(); selectedSquare = null; }
                }
            }
        }
    }

    function updateStatus() {
        if (!game) { statusEl.text("Game not initialized."); return; }
        let currentStatusText = '';
        const currentTurnColorDisplay = (game.turn() === 'w') ? 'White' : 'Black';
        turnEl.text(currentTurnColorDisplay);

        if (gameEndedManually) {
            currentStatusText = `Game Over: ${gameEndReason}`;
            if (gameEndReason.toLowerCase().includes("draw")) {
                statusEl.css('color', 'orange');
            } else if (gameEndReason.toLowerCase().includes("conceded")) {
                const playerColorName = actualPlayerColor === 'w' ? "White" : "Black";
                if (gameEndReason.includes(playerColorName + " conceded")) {
                    statusEl.css('color', 'red'); // Player conceded
                } else { // AI conceded (not implemented but for future) or other win
                    statusEl.css('color', 'lightgreen');
                }
            } else { statusEl.css('color', 'white'); }
        } else if (game.in_checkmate()) {
            currentStatusText = `Game Over: ${currentTurnColorDisplay} is in checkmate.`;
            statusEl.css('color', 'red');
        } else if (game.in_draw()) {
            currentStatusText = 'Game Over: Draw';
            if (game.in_stalemate()) currentStatusText += ' (Stalemate)';
            if (game.in_threefold_repetition()) currentStatusText += ' (Threefold Repetition)';
            if (game.in_insufficient_material()) currentStatusText += ' (Insufficient Material)';
            statusEl.css('color', 'orange');
        } else { // Game ongoing
            const isEndgameForSearch = isEndgamePhaseForSearch(game);
            const usingDeeperFixedSearch = isEndgameForSearch && AI_ENDGAME_SEARCH_DEPTH > AI_SEARCH_DEPTH;
            let thinkingText = "OmniBot (Enhanced AI) is thinking";

            if (aiIsThinking && !aiOfferedDrawPendingPlayerResponse) { // Standard AI thinking
                 if (usingDeeperFixedSearch) thinkingText += " (deep search)..."; else thinkingText += "...";
            }

            if (playerOfferedDrawPendingAIResponse) {
                currentStatusText = "Player offered draw. AI is considering...";
            } else if (aiOfferedDrawPendingPlayerResponse) {
                // The text is already set in aiDrawOfferControls span by makeAIMove
                currentStatusText = aiDrawOfferControls.find('span').text();
            } else {
                currentStatusText = (game.turn() === actualPlayerColor) ? "Your turn" : (aiIsThinking ? thinkingText : "OmniBot's turn");
            }

            if (game.in_check() && !aiOfferedDrawPendingPlayerResponse && !playerOfferedDrawPendingAIResponse) { // Don't overwrite draw offer status with check status
                currentStatusText += ` (${currentTurnColorDisplay} is in check).`;
                statusEl.css('color', 'DarkOrange');
            } else if (!aiOfferedDrawPendingPlayerResponse && !playerOfferedDrawPendingAIResponse) { // Only set default color if not in draw offer state
                statusEl.css('color', '#ffc107');
            }
        }
        statusEl.text(currentStatusText);
        fenEl.text(game.fen());
        pgnEl.val(game.pgn({ max_width: 72, newline_char: '\n' }));
        pgnEl.scrollTop(pgnEl[0].scrollHeight);

        const gameOver = game.game_over() || gameEndedManually;
        const canPlayerMakeMove = !gameOver && !aiIsThinking && !playerOfferedDrawPendingAIResponse && !aiOfferedDrawPendingPlayerResponse && game.turn() === actualPlayerColor;
        // Board interaction (clicking squares) is implicitly handled by the conditions at the start of handleSquareClick

        newGameButton.prop('disabled', aiIsThinking && aiOfferedDrawPendingPlayerResponse);
        undoButton.prop('disabled', gameOver || game.history().length === 0 || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse );
        offerDrawButton.prop('disabled', gameOver || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse || game.turn() !== actualPlayerColor);
        concedeButton.prop('disabled', gameOver || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse);

        // Show/hide AI draw offer controls based on state, not just gameOver
        if (aiOfferedDrawPendingPlayerResponse) {
            aiDrawOfferControls.show();
        } else {
            aiDrawOfferControls.hide();
        }
    }

    function startNewGame() {
        if (aiIsThinking && aiOfferedDrawPendingPlayerResponse) {
            console.warn("AI is waiting for draw response, cannot start new game now.");
            statusEl.text("Please respond to AI's draw offer first.");
            return;
        }
        if (typeof Chess !== 'function') { statusEl.text("ERROR: Chess.js library not loaded."); return; }
        if (!playerColorSelect || playerColorSelect.length === 0) { statusEl.text("ERROR: UI element missing."); return; }
        game = new Chess();
        aiIsThinking = false;
        clearPieceLift(); clearBoardHighlights(); selectedSquare = null;

        gameEndedManually = false;
        gameEndReason = '';
        playerOfferedDrawPendingAIResponse = false;
        aiOfferedDrawPendingPlayerResponse = false;
        aiOfferedDrawMoveSAN = null;
        // aiDrawOfferControls.hide(); // This will be handled by updateStatus

        playerChoosesColor = playerColorSelect.val();
        actualPlayerColor = (playerChoosesColor === 'random') ? (Math.random() < 0.5 ? 'w' : 'b') : playerChoosesColor.charAt(0);
        playerOrientation = (actualPlayerColor === 'w') ? 'white' : 'black';
        const boardConfig = { draggable: false, position: 'start', orientation: playerOrientation, pieceTheme: 'img/chesspieces/wikipedia/{piece}.png', };
        if (board) { board.orientation(playerOrientation); board.position('start', false); }
        else { board = Chessboard('board', boardConfig); $(window).resize(board.resize); $('#board').on('click', '.square-55d63', function() { const clickedSquareName = $(this).attr('data-square'); if (clickedSquareName) handleSquareClick(clickedSquareName); }); }
        
        updateStatus(); // Call this before playing sound or making AI move
        playSound('game-start');

        if (!game.game_over() && game.turn() !== actualPlayerColor) {
            makeAIMove();
        } else if (!game.game_over()){
             // updateStatus would have set "Your turn" or similar
        }
    }

    function undoLastPlayerMove() {
        if (!game || game.history().length === 0 || aiIsThinking || game.game_over() || gameEndedManually) return;

        if (aiOfferedDrawPendingPlayerResponse) {
            aiOfferedDrawPendingPlayerResponse = false;
            aiOfferedDrawMoveSAN = null;
            // aiDrawOfferControls.hide(); // updateStatus will handle this
        }
        if (playerOfferedDrawPendingAIResponse) {
            playerOfferedDrawPendingAIResponse = false;
        }
        aiIsThinking = false; // Reset, as undo might change whose turn it is or what AI was doing

        clearPieceLift(); clearBoardHighlights(); selectedSquare = null;
        const historyLen = game.history().length;
        // Undo logic: If it was AI's turn, player undoes AI's move AND their own previous move.
        // If it was player's turn, player undoes their own last move.
        // For simplicity with AI: always undo 2 moves if AI just moved, 1 if player about to move.
        // This simplified logic makes more sense for "undo player move" button.
        // Let's assume it means undo the last FULL turn (player + AI if AI played).
        // Or, more simply, undo to get to player's previous turn.
        if (game.turn() === actualPlayerColor && historyLen >= 2) { // AI just moved, player wants to undo their prior move + AI's response
            game.undo(); game.undo();
        } else if (game.turn() !== actualPlayerColor && historyLen >= 1) { // Player about to move, wants to undo their last move
            game.undo();
        } else if (historyLen > 0) { // Fallback, undo one move
            game.undo();
        } else { return; } // No history

        if (board) board.position(game.fen());
        playSound('undo');
        updateStatus();

        if (!game.game_over() && !gameEndedManually && game.turn() !== actualPlayerColor && !aiIsThinking) {
            makeAIMove();
        }
    }

    offerDrawButton.on('click', function() {
        if (!game || game.game_over() || gameEndedManually || game.turn() !== actualPlayerColor || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse) return;

        playerOfferedDrawPendingAIResponse = true;
        updateStatus();

        setTimeout(() => {
            if (!playerOfferedDrawPendingAIResponse) return; // Offer cancelled by undo/new game

            const aiActualColor = (actualPlayerColor === 'w' ? 'b' : 'w');
            const currentEvalForAI = evaluateBoard(game, aiActualColor);

            if (currentEvalForAI < AI_ACCEPTS_PLAYER_DRAW_OFFER_THRESHOLD) {
                gameEndedManually = true;
                gameEndReason = "Draw by agreement (Player offered, AI accepted).";
                playSound('game-start'); // Notify sound
                // statusEl.text(gameEndReason + ` AI eval: ${currentEvalForAI.toFixed(0)}.`); // updateStatus will handle
            } else {
                // statusEl.text(`AI rejected draw offer (AI eval: ${currentEvalForAI.toFixed(0)}). Your turn.`); // updateStatus will handle
                // No explicit message here, updateStatus will revert to "Your turn"
            }
            playerOfferedDrawPendingAIResponse = false;
            updateStatus();
        }, 1000);
    });

    concedeButton.on('click', function() {
        if (!game || game.game_over() || gameEndedManually || aiIsThinking || playerOfferedDrawPendingAIResponse || aiOfferedDrawPendingPlayerResponse) return;

        if (confirm("Are you sure you want to concede the game?")) {
            gameEndedManually = true;
            const winner = (actualPlayerColor === 'w' ? 'Black' : 'White');
            const loserColorName = actualPlayerColor === 'w' ? "White" : "Black";
            gameEndReason = `${loserColorName} conceded. ${winner} wins.`;
            playSound('game-start'); // Notify sound
            updateStatus();
        }
    });

    acceptAIDrawButton.on('click', function() {
        if (!aiOfferedDrawPendingPlayerResponse) return;
        gameEndedManually = true;
        gameEndReason = "Draw by agreement (AI offered, Player accepted).";
        playSound('game-start'); // Notify sound
        aiOfferedDrawPendingPlayerResponse = false;
        aiOfferedDrawMoveSAN = null;
        // aiDrawOfferControls.hide(); // updateStatus handles this
        aiIsThinking = false;
        updateStatus();
    });

    declineAIDrawButton.on('click', function() {
        if (!aiOfferedDrawPendingPlayerResponse || !aiOfferedDrawMoveSAN) return;

        // aiDrawOfferControls.hide(); // updateStatus handles this
        const moveSANToMake = aiOfferedDrawMoveSAN; // Copy before resetting
        aiOfferedDrawPendingPlayerResponse = false; // Reset state first
        aiOfferedDrawMoveSAN = null;
        aiIsThinking = true; // AI is now "making" the move

        updateStatus(); // Reflect that player has responded, AI is proceeding

        // Short delay to allow status update to render, then make move.
        setTimeout(() => {
            const moveResult = game.move(moveSANToMake);
            if (moveResult) {
                if (board) board.position(game.fen());
                playSound('move-opponent');
                if (game.in_check()) playSound('check');
            } else {
                console.error("[AI makeAIMove] ERROR: chess.js rejected AI's stored move after draw decline:", moveSANToMake, "FEN:", game.fen());
            }
            aiIsThinking = false; // AI's action is complete
            updateStatus();
            // If it's player's turn now and game not over, player can play.
            // If game ended by AI's move (e.g., checkmate), updateStatus covers this.
        }, 50);
    });


    newGameButton.on('click', startNewGame);
    undoButton.on('click', undoLastPlayerMove);
    setTimeout(() => { if (typeof Chess === 'function') startNewGame(); else { console.error("Delayed Start: Chess.js failed."); statusEl.text("Error: Chess.js failed. Check console."); } }, 300);
});

// --- END OF FILE script.js ---