import { Tabs as PFTabs, Tab, TabTitleText } from '@patternfly/react-core';
import React from 'react';
import { ParamHelper } from 'src/utilities';

export class TabsType {
  id: string;
  name: string;
}

interface IProps {
  /** List of names for tabs */
  tabs: TabsType[];
  /** Current page params */
  params: { tab?: string };

  /** Sets the current page params to p */
  updateParams: (params) => void;

  /** Disables tab controls */
  isDisabled?: boolean;
  disabledTitle?: string;
}

// FIXME: use LinkTabs, switch from ?tab to routes, rename to Tabs
export const Tabs = ({
  tabs,
  params,
  updateParams,
  isDisabled,
  disabledTitle,
}: IProps) => (
  <PFTabs
    activeKey={getActiveTab({ params, tabs })}
    onSelect={(_, key) =>
      !isDisabled &&
      updateParams(
        ParamHelper.setParam(params, 'tab', tabs[key].id.toLowerCase()),
      )
    }
  >
    {tabs.map((tab, i) => (
      <Tab
        key={i}
        eventKey={i}
        title={
          <TabTitleText title={isDisabled ? disabledTitle : null}>
            {tab.name}
          </TabTitleText>
        }
        className={isDisabled ? 'disabled' : null}
      />
    ))}
  </PFTabs>
);

function getActiveTab({ params, tabs }) {
  if (params.tab) {
    const i = tabs.findIndex(
      (x) => x.id.toLowerCase() === params.tab.toLowerCase(),
    );

    // If tab is not found, default to the first tab.
    if (i === -1) {
      return 0;
    } else {
      return i;
    }
  } else {
    return 0;
  }
}
