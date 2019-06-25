// ==UserScript==
// @name         GitLab - JIRA
// @description  Minor JIRA integration into GitLab
// @version      0.1.0
// @namespace    http://gitlab.usyuop.eu/
// @author       bubblefoil
// @license      MIT
// @match        http://gitlab.usyuop.eu:10080/*/*/merge_requests/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      jira.unicorn.eu
// ==/UserScript==

(function () {
    'use strict';

    const jiraUrl = 'https://jira.unicorn.eu';
    const jiraBrowseIssue = jiraUrl + "/browse";
    const jiraRestApiUrl = jiraUrl + '/rest/api/2';
    const jiraRestApiUrlIssue = jiraRestApiUrl + '/issue';
    const jiraIssueKeyPattern = /([A-Z]+-\d+)/;

    function globalJiraIssueKeyRegex() {
        return new RegExp(jiraIssueKeyPattern, "g");
    }

    function getTitle() {
        return document.querySelector('h2.title');
    }

    function getJiraIssueKeyFromTitle() {
        const match = getTitle().innerText.match(globalJiraIssueKeyRegex());
        return match[0];
    }

    function getTargetBranchFromMR() {
        return document.querySelector('span.label-branch > a.js-target-branch').innerText;
    }

    function getJiraComment(targetBranch) {
        return `Merged into ${targetBranch}`;
    }

    function getMrWidgetChild() {
        return document.querySelector('div.media-body-wrap.space-children');
    }

    /**
     * 
     * @param {HTMLElement} element The element whose text content with JIRA issue code will be replaced with JIRA issue link.
     */
    function replaceIssueByLink(element) {
        if (!element) {
            console.error('Cannot replace element text with jira link, element is ', element);
            return;
        }
        element.innerHTML = element.innerHTML
            .replace(globalJiraIssueKeyRegex(), `<a href="${jiraBrowseIssue}/$1" target="_blank">$1</a>`);
    }

    function addJiraCommentWidget() {
        getMrWidgetChild().insertAdjacentHTML('afterend',
            `<div class="media-body-wrap space-children">
            <label><input id="add-jira-merge-comment" type="checkbox" class="js-remove-source-branch-checkbox">Add JIRA comment</label>
            <button id="add-jira-merge-comment-manually" class="btn btn-sm btn-success">Manually</button>
            </div>`
        );
    }

    function sendJiraComment() {
        const key = getJiraIssueKeyFromTitle();
        const comment = getJiraComment(getTargetBranchFromMR());
        console.debug(`Sending JIRA comment '${comment}' request on issue ${key}`, key);
        addJiraComment({
            key: key,
            comment: comment,
            onSuccess: (response) => console.info("Success, comment added.", response.status),
            onError: (response) => console.error("Failed to add comment.", response.responseText)
        });
    }

    function addMergeListener() {
        // Fixme enable Mergebutton listener
        // getMergeButton().addEventListener('click', sendJiraComment);
        document.querySelector('#add-jira-merge-comment-manually').addEventListener('click', sendJiraComment);
    }


    /**
     * @param {string} comment.key JIRA issue key string.
     * @param {string} comment.comment The comment text.
     * @param {Function} [comment.onSuccess] Callback to be invoked on response from JIRA.
     * @param {Function} [comment.onError] Callback to be invoked in case the JIRA request fails.
     * @param {Function} [comment.onReadyStateChange] Callback to be invoked when the request state changes.
     */
    function addJiraComment(comment) {
        console.log(`Sending a comment request. Issue=${comment.key}, Comment="${comment.comment}"`);
        const body = `{ "body": "${comment.comment}" }`;
        // noinspection JSUnresolvedFunction
        GM_xmlhttpRequest(
            {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    //Disable the cross-site request check on the JIRA side
                    "X-Atlassian-Token": "nocheck",
                    //Previous header does not work for requests from a web browser
                    "User-Agent": "xx"
                },
                data: body,
                url: `${jiraRestApiUrlIssue}/${comment.key}/comment`,
                onreadystatechange: comment.onReadyStateChange,
                onload: comment.onSuccess,
                onerror: comment.onError
            }
        );
    }

    /**
     * Activates all the enhancments.
     */
    function enhanceMergeRequestPage() {
        replaceIssueByLink(getTitle());
        addJiraCommentWidget();
        addMergeListener();
    }

    enhanceMergeRequestPage();
})();
