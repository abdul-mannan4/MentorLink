import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./MentorCard.module.css";
import { Star, ChevronRight } from "lucide-react";

type Props = {
  image: string;
  userName: string;
  Description: string;
};

const MentorCard = ({ image, userName, Description }: Props) => {
  const navigate = useNavigate();
  const goToProfile = () => {
    // This sends the user to /mentor/Ali (or whatever the username is)
    navigate("/mentor");
  };

  return (
    <div className={styles.mentorCard} onClick={goToProfile}>
      <div className={styles.cardHeader}>
        <div className={styles.imageContainer}>
          <img
            src={image}
            alt={`${userName} Profile`}
            className={styles.mentorImage}
          />
          <div className={styles.onlineBadge}></div>
        </div>
        <div className={styles.headerInfo}>
          <h3 className={styles.userName}>{userName}</h3>
          <div className={styles.rankingBadge}>
            <Star size={12} className={styles.starIcon} />
            <span>Top Mentor</span>
          </div>
        </div>
      </div>

      <p className={styles.descriptionTruncated}>
        {Description}
      </p>

      <div className={styles.cardFooter}>
        <span className={styles.seeMoreBtn}>
          View Profile <ChevronRight size={16} />
        </span>
      </div>
    </div>
  );
};

export default MentorCard;
