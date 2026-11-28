import {SiteFooter, SiteHeader} from '../community-ui';
import LeaderboardView from './leaderboard';

export default function BuilderDayPage() {
  return <><SiteHeader/><main id="main"><LeaderboardView/></main><SiteFooter/></>;
}
