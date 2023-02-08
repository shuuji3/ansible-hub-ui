import { t } from '@lingui/macro';
import { DropdownItem } from '@patternfly/react-core';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Paths, formatPath } from 'src/paths';
import { getRepoUrl } from 'src/utilities';
import {
  ClipboardCopy,
  DateComponent,
  EmptyStateNoData,
  SortTable,
  StatefulDropdown,
} from '..';

interface IProps {
  repositories: {}[];
  updateParams: (p) => void;
}

export class LocalRepositoryTable extends React.Component<IProps> {
  constructor(props) {
    super(props);
  }

  render() {
    const { repositories } = this.props;
    if (repositories.length === 0) {
      return (
        <EmptyStateNoData
          title={t`No local repositories yet`}
          description={''}
        />
      );
    }
    return this.renderTable(repositories);
  }

  private renderTable(repositories) {
    const params = { sort: 'repository' };
    let sortTableOptions = {
      headers: [
        {
          title: t`Distribution name`,
          type: 'none',
          id: 'distribution',
        },
        {
          title: t`Repository name`,
          type: 'none',
          id: 'repository',
        },
        {
          title: t`Content count`,
          type: 'none',
          id: 'content',
        },
        {
          title: t`Last updated`,
          type: 'none',
          id: 'updated_at',
        },
        {
          title: t`Repo URL`,
          type: 'none',
          id: 'ansible_cli_url',
        },
        {
          title: t`CLI configuration`,
          type: 'none',
          id: 'cli_config',
        },
      ],
    };

    return (
      <table
        aria-label={t`Collection versions`}
        className='content-table pf-c-table'
      >
        <SortTable
          options={sortTableOptions}
          params={params}
          updateParams={(p) => console.log(p)}
        />
        <tbody>
          {repositories.map((distribution) => this.renderRow(distribution))}
        </tbody>
      </table>
    );
  }

  private renderRow(distribution) {
    const cliConfig = [
      '[galaxy]',
      `server_list = ${distribution.repository.name}_repo`,
      '',
      `[galaxy_server.${distribution.repository.name}_repo]`,
      `url=${getRepoUrl(distribution.base_path)}`,
      'token=<put your token here>',
    ];

    return (
      <tr key={distribution.name}>
        <td>{distribution.name}</td>
        <td>{distribution.repository.name}</td>
        <td>{distribution.repository.content_count}</td>
        {!!distribution.repository.pulp_last_updated ? (
          <td>
            <DateComponent date={distribution.repository.pulp_last_updated} />
          </td>
        ) : (
          <td>{'---'}</td>
        )}
        <td>
          <ClipboardCopy isReadOnly>
            {getRepoUrl(distribution.base_path)}
          </ClipboardCopy>
        </td>
        <td>
          <ClipboardCopy isCode isReadOnly variant={'expansion'}>
            {cliConfig.join('\n')}
          </ClipboardCopy>
        </td>
      </tr>
    );
  }
}
