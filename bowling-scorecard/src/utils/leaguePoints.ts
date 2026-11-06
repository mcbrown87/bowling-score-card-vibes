import type { StoredGameSummary, StoredImageSummary } from '@/types/stored-image';

export type LeaguePointRow = {
  label: string;
  homeScore: number;
  awayScore: number;
  homePlayerName?: string;
  awayPlayerName?: string;
  homePoints: number;
  awayPoints: number;
};

export type LeaguePointBreakdown = {
  homeScores: number[];
  awayScores: number[];
  homeScore: number;
  awayScore: number;
  homePoints: number;
  awayPoints: number;
  points: LeaguePointRow[];
};

const gameScore = (game: StoredGameSummary) =>
  Math.max(Number(game.totalScore) || 0, Number(game.tenthFrame.score) || 0);

const teamGames = (image: StoredImageSummary, teamId: string) =>
  image.games.reduce<Array<{ score: number; playerName: string }>>((games, game, index) => {
    const assignedTeamId =
      game.team?.id ?? (index < 4 ? image.team?.id : image.opponentTeam?.id);
    if (assignedTeamId === teamId) {
      games.push({
        score: gameScore(game),
        playerName: game.player?.name ?? game.playerName ?? 'Player'
      });
    }
    return games;
  }, []).sort((a, b) => b.score - a.score);

const awardedPoint = (homeScore: number, awayScore: number) =>
  homeScore === awayScore
    ? { homePoints: 0.5, awayPoints: 0.5 }
    : { homePoints: homeScore > awayScore ? 1 : 0, awayPoints: awayScore > homeScore ? 1 : 0 };

export const calculateLeaguePoints = (image: StoredImageSummary): LeaguePointBreakdown | null => {
  if (!image.isLeagueGame || !image.team || !image.opponentTeam) return null;

  const homeGames = teamGames(image, image.team.id);
  const awayGames = teamGames(image, image.opponentTeam.id);
  if (homeGames.length < 4 || awayGames.length < 4) return null;

  const homeScores = homeGames.map((game) => game.score);
  const awayScores = awayGames.map((game) => game.score);

  const homeScore = homeScores.reduce((total, score) => total + score, 0);
  const awayScore = awayScores.reduce((total, score) => total + score, 0);
  const rankLabels = ['High game', '2nd game', '3rd game', '4th game'];
  const points: LeaguePointRow[] = rankLabels.map((label, index) => ({
    label,
    homeScore: homeScores[index],
    awayScore: awayScores[index],
    homePlayerName: homeGames[index].playerName,
    awayPlayerName: awayGames[index].playerName,
    ...awardedPoint(homeScores[index], awayScores[index])
  }));
  points.push({ label: 'Team total', homeScore, awayScore, ...awardedPoint(homeScore, awayScore) });

  return {
    homeScores,
    awayScores,
    homeScore,
    awayScore,
    homePoints: points.reduce((total, point) => total + point.homePoints, 0),
    awayPoints: points.reduce((total, point) => total + point.awayPoints, 0),
    points
  };
};
