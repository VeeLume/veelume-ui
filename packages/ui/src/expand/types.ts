/** A label/value pair inside an expansion. */
export type Fact = {
	label: string;
	value: string;
	/** Ids, record paths, build numbers, hashes — anything read character by
	 *  character rather than as a word. */
	mono?: boolean;
};
