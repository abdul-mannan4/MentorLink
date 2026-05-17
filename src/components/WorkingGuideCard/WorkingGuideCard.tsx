import React from "react";
import "../WorkingGuideCard/WorkingCardGuide.css";
interface Props {
  noIcon: string;
  title: string;
  description: string;
  noBg: string;
  noColor: string;
}

const Card = ({ noIcon, noBg, title, description, noColor }: Props) => {
  return (
    <div className="WGcardStyles hidden">
      <span
        className="WGnoIcon"
        style={{ backgroundColor: noBg, color: noColor }}
      >
        {noIcon}
      </span>
      <p className="WGcardTitle">{title}</p>
      <p className="WGcardDescription">{description}</p>
    </div>
  );
};

export default Card;
