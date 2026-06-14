import "./WhyCard.css";
interface Props {
  icon: string;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  link?: string;
}

const Card = ({ icon, iconBg, title, description, iconColor }: Props) => {
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
      {/* {link ? (
        <a href={link} className="cardLink" style={{ color: "#185FA5" }}>
          Learn more →
        </a>
      ) : null} */}
    </div>
  );
};

export default Card;
