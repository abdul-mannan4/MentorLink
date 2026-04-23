import React from "react";
import "./WhyCard.css";
interface Props {
  icon: string;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  link: string;
}

const Card = ({ icon, iconBg, title, description, iconColor, link }: Props) => {
  return (
    <div className="cardStyles">
      <span
        className="cardIcon"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </span>
      <p className="cardTitle">{title}</p>
      <p className="cardDescription">{description}</p>
      <a href={link} className="cardLink" style={{ color: "#185FA5" }}>
        Learn more →
      </a>
    </div>
  );
};

export default Card;
