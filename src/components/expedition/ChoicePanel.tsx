import { useGameStore, makeCommandId } from '../../store/game-store.js';
import { ChoiceCard } from './ChoiceCard.js';

export function ChoicePanel() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const decision = state.pendingDecision;
  if (!decision) {
    return <div className="choice-panel" />;
  }
  if (decision.type === 'travel') {
    return (
      <div className="choice-panel">
        {decision.generatedChoices.map((c) => (
          <ChoiceCard
            key={c.id}
            choice={c}
            onClick={() => {
              if (decision.type === 'travel') {
                dispatch({
                  type: 'SELECT_TRAVEL_PACE',
                  decisionId: decision.id,
                  pace: c.sourceDefinitionId === 'travel.careful' ? 'careful'
                    : c.sourceDefinitionId === 'travel.rush' ? 'rush' : 'normal',
                  commandId: makeCommandId('pace'),
                });
              }
            }}
          />
        ))}
      </div>
    );
  }
  if (decision.type === 'encounter') {
    return (
      <div className="choice-panel">
        {decision.generatedChoices.map((c) => (
          <ChoiceCard
            key={c.id}
            choice={c}
            onClick={() => {
              dispatch({
                type: 'CHOOSE_TACTICAL_OPTION',
                decisionId: decision.id,
                choiceId: c.id,
                commandId: makeCommandId('tac'),
              });
            }}
          />
        ))}
      </div>
    );
  }
  if (decision.type === 'route') {
    return (
      <div className="choice-panel">
        {decision.generatedChoices.map((c) => (
          <ChoiceCard
            key={c.id}
            choice={c}
            onClick={() => {
              dispatch({
                type: 'SELECT_ROUTE',
                decisionId: decision.id,
                choiceId: c.id,
                commandId: makeCommandId('route'),
              });
            }}
          />
        ))}
      </div>
    );
  }
  // event / inventory / retreat
  return (
    <div className="choice-panel">
      {decision.generatedChoices.map((c) => (
        <ChoiceCard
          key={c.id}
          choice={c}
          onClick={() => {
            if (decision.type === 'event' || decision.type === 'inventory' || decision.type === 'retreat') {
              if (c.sourceDefinitionId === 'retreat.confirm' || c.sourceDefinitionId === 'retreat.yes') {
                dispatch({ type: 'CONFIRM_RETREAT', commandId: makeCommandId('retreat') });
                return;
              }
              if (c.sourceDefinitionId === 'retreat.cancel' || c.sourceDefinitionId === 'retreat.no') {
                dispatch({ type: 'CHOOSE_EVENT_OPTION', decisionId: decision.id, choiceId: c.id, commandId: makeCommandId('ev') });
                return;
              }
              dispatch({ type: 'CHOOSE_EVENT_OPTION', decisionId: decision.id, choiceId: c.id, commandId: makeCommandId('ev') });
            }
          }}
        />
      ))}
    </div>
  );
}
