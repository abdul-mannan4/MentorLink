import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./QuestionCard.module.css";
import { supabase } from "../../supabase-client";

interface QuestionCardProps {
  id: string;
  subject: string;
  topic: string;
  description: string;
  teacherName: string;
  uploadedAt: string;
  fileUpload?: string | null;
}

const QuestionCard = ({
  id,
  subject,
  topic,
  description,
  teacherName,
  uploadedAt,
  fileUpload,
}: QuestionCardProps) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFile, setShowFile] = useState(false);
  
  const [replyData, setReplyData] = useState<{
    description: string;
    mentorName: string;
  } | null>(null);
  const [isLoadingReply, setIsLoadingReply] = useState(true);

  useEffect(() => {
    const fetchReply = async () => {
      // Fetch the oldest reply (first reply)
      const { data: rData } = await supabase
        .from("reply")
        .select("description, mentor_id")
        .eq("question_id", id)
        .order("replied_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (rData) {
        // Fetch mentor's profile name
        const { data: pData } = await supabase
          .from("profile")
          .select("user_name")
          .eq("id", rData.mentor_id)
          .maybeSingle();

        setReplyData({
          description: rData.description,
          mentorName: pData?.user_name || "Mentor",
        });
      }
      setIsLoadingReply(false);
    };
    fetchReply();
  }, [id]);

  useEffect(() => {
    document.body.style.overflow = isExpanded || showFile ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isExpanded, showFile]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const closeAll = () => {
    setIsExpanded(false);
    setShowFile(false);
  };

  const isImage = (url: string) => /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url);

  return (
    <>
      {/* ── LIST CARD VIEW ── */}
      <div className={styles.questionCard} onClick={() => setIsExpanded(true)}>
        <div className={styles.subjectHeader}>
          <span className={styles.subjectBadge}>{subject}</span>
        </div>
        <div className={styles.infoSection}>
          <div className={styles.labelGroup}>
            <span className={styles.headingLabel}>Topic</span>
            <h3 className={styles.topicText}>{topic}</h3>
          </div>
          <div className={styles.labelGroup}>
            <span className={styles.headingLabel}>Description</span>
            <p className={styles.truncatedDescription}>{description}</p>
            {(!replyData && !isLoadingReply) ? null : <span className={styles.readMore}>Read more →</span>}
          </div>
          
          {!isLoadingReply && (
            replyData ? (
              <div className={styles.replySection}>
                <div className={styles.replyHeader}>Mentor Reply ({replyData.mentorName})</div>
                <p className={styles.replyDescription}>{replyData.description}</p>
                <span className={styles.readMore}>Read more →</span>
              </div>
            ) : (
              <div className={styles.noReplySection}>
                <span className={styles.noReplyText}>⏳ No reply yet</span>
                <span className={styles.readMore} style={{marginTop: '0'}}>Read more →</span>
              </div>
            )
          )}
        </div>
        <div className={styles.questionFooter}>
          <div className={styles.metaRow}>
            <span>
              Prof. {teacherName} • {formatDate(uploadedAt)}
            </span>
          </div>
          {fileUpload && (
            <button
              className={styles.fileLink}
              onClick={(e) => {
                e.stopPropagation();
                setShowFile(true);
              }}
            >
              View Attachment
            </button>
          )}
        </div>
      </div>

      {/* ── MODAL LAYER ── */}
      {(isExpanded || showFile) && (
        <div className={styles.modalWrapper}>
          <div className={styles.cardOverlay} onClick={closeAll} />
          <div
            className={showFile ? styles.fileViewerCard : styles.expandedCard}
          >
            {/* ── HEADER WITH CENTERED X ── */}
            <div className={styles.subjectHeader}>
              <span className={styles.subjectBadge}>{subject}</span>
              <button
                className={styles.modalCloseBtn}
                onClick={closeAll}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              {showFile ? (
                <div className={styles.viewContainer}>
                  <div className={styles.modalHeaderRow}>
                    <button
                      className={styles.backBtn}
                      onClick={() => setShowFile(false)}
                    >
                      ← Back
                    </button>
                    <span className={styles.headingLabel}>
                      Attachment Preview
                    </span>
                  </div>
                  <div className={styles.scrollArea}>
                    {fileUpload && isImage(fileUpload) ? (
                      <img
                        src={fileUpload}
                        alt="Attachment"
                        className={styles.previewImage}
                      />
                    ) : (
                      <div className={styles.filePlaceholder}>
                        <span style={{ fontSize: "2rem" }}>📄</span>
                        <p>Document Attached</p>
                        <a
                          href={fileUpload ?? ""}
                          download
                          className={styles.fileLink}
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.viewContainer}>
                  <div className={styles.labelGroup}>
                    <span className={styles.headingLabel}>Topic</span>
                    <h2 className={styles.fullTopic}>{topic}</h2>
                  </div>
                  <div
                    className={styles.labelGroup}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      minHeight: 0,
                    }}
                  >
                    <span className={styles.headingLabel}>Description</span>
                    <div className={styles.scrollArea}>
                      <p className={styles.fullDescription}>{description}</p>
                      
                      {!isLoadingReply && (
                        replyData ? (
                          <div className={styles.replySection} style={{ marginTop: '2rem' }}>
                            <div className={styles.replyHeader}>Mentor Reply ({replyData.mentorName})</div>
                            <p className={styles.fullReplyDescription}>{replyData.description}</p>
                          </div>
                        ) : (
                          <div className={styles.noReplySection} style={{ marginTop: '2rem' }}>
                            <span className={styles.noReplyText}>⏳ No reply yet</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                  <div className={styles.modalDetailFooter}>
                    <div className={styles.teacherProfileBox}>
                      <div className={styles.avatarIcon}>
                        {teacherName.charAt(0)}
                      </div>
                      <div className={styles.teacherText}>
                        <span className={styles.profName}>
                          Prof. {teacherName}
                        </span>
                        <span className={styles.uploadInfo}>
                          Uploaded on {formatDate(uploadedAt)}
                        </span>
                      </div>
                    </div>
                    {fileUpload && (
                      <button
                        className={styles.fileLink}
                        onClick={() => setShowFile(true)}
                      >
                        View Attachment
                      </button>
                    )}
                    <button
                      className={styles.fullViewBtn}
                      onClick={() => navigate(`/question/${id}`)}
                    >
                      View Full Discussion →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default QuestionCard;
