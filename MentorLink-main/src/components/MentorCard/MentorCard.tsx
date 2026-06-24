import { useNavigate } from "react-router-dom";
import styles from "./MentorCard.module.css";
import { ChevronRight, Award } from "lucide-react";
import userIcon from "../../assets/userIcon.svg";
import { useSignedImage } from "../../Hooks/UseScrollRevealHook/useSignedImage";

type Props = {
  mentorId?: string;
  image?: string;
  userName: string;
  Description: string;
  rank?: number;
  reviews?: number;
  score?: number | null;
};

const MentorCard = ({ mentorId, image, userName, Description, rank = 0, reviews = 0, score = null }: Props) => {
  const navigate = useNavigate();
  const signedImageUrl = useSignedImage(image ?? "");
  
  const goToProfile = () => {
    if (!mentorId) return;
    navigate(`/mentor/${mentorId}`);
  };

  const avatar = signedImageUrl || image || userIcon;
  const displayRank = Number(rank); 
  const hasValidRank = !isNaN(displayRank) && displayRank > 0;
  const badgeLabel = hasValidRank ? `Rank #${displayRank}` : "Unranked Mentor";

  const rankPill = hasValidRank
    ? displayRank <= 3 ? "Elite Mentor" : "Top Mentor"
    : score !== null && score >= 12 ? "Top Scorer" : reviews >= 15 ? "Popular Mentor" : reviews >= 5 ? "Rising Mentor" : "New Mentor";

  const badgeMeta = hasValidRank
    ? `#${displayRank} Overall`
    : score !== null ? `Avg Score ${score.toFixed(1)}` : `${reviews} replies`;

  return (
    <div className={styles.mentorCard}>
      <div className={styles.mentorCardTop}>
        <div className={styles.mentorBadge}>
          <div className={styles.badgeIconWrapper}>
            <Award size={16} className={styles.badgeIcon} />
          </div>
          <div>
            <div className={styles.badgeTitle}>{badgeLabel}</div>
            <div className={styles.badgeMeta}>{badgeMeta}</div>
          </div>
        </div>
        <span className={styles.mentorPill}>{rankPill}</span>
      </div>

      <div className={styles.cardHeader}>
        <div className={styles.imageContainer}>
          <img
            src={avatar}
            alt={`${userName} Profile`}
            className={styles.mentorImage}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = userIcon;
            }}
          />
          <div className={styles.onlineBadge}></div>
        </div>
        <div className={styles.headerInfo}>
          <h3 className={styles.userName}>{userName}</h3>
        </div>
      </div>

      <p className={styles.descriptionTruncated}>{Description}</p>

      {score !== null && (
        <div className={styles.scoreSummary}>
          Subject Test Avg:{" "}
          <strong>
            {score > 15 ? `${score.toFixed(1)}%` : `${score.toFixed(1)} / 15`}
          </strong>
        </div>
      )}

      <div className={styles.cardFooter}>
        <button
          className={styles.seeMoreBtn}
          onClick={goToProfile}
          aria-label={`View ${userName}'s profile`}
        >
          View Profile <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default MentorCard;
