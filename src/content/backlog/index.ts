import topics from "../../../docs/curriculum/topics.json";
import { LESSON_TOPICS } from "./coverage";
import { buildTopicCards, type Curriculum } from "./topicCards";

/** The curriculum map's data: the one source for backlog cards. */
export const CURRICULUM: Curriculum = topics;

/** Every curriculum topic without a lesson, as a locked card (status `planned`). */
export const TOPIC_CARDS = buildTopicCards(CURRICULUM, LESSON_TOPICS);
