// ==UserScript==
// @name         GitLab - JIRA
// @description  Minor JIRA integration into GitLab
// @version      0.2.1
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
        return match ? match[0] : '';
    }

    function getTargetBranchFromMR() {
        return document.querySelector('span.label-branch > a.js-target-branch').innerText;
    }

    function getJiraComment(targetBranch) {
        return `Merged into ${targetBranch}`;
    }

    function getMrWidgetSection() {
        return document.querySelector('div.mr-widget-section');
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
        if (!getMrWidgetSection()) {
            return;
        }
        getMrWidgetSection().insertAdjacentHTML('afterend',
            `<div class="mr-widget-body media" style=" white-space: nowrap;">
                    <button id="add-jira-merge-comment-manually" class="btn btn-sm btn-success" ${!getJiraIssueKeyFromTitle() ? 'disabled' : ''}>Add JIRA comment</button>
                    <input id="jira-merge-comment-input" type="text" class="form-control pad qa-issuable-form-title" value="${getJiraComment(getTargetBranchFromMR())}">
                </div>`
        );

        const commentInput = document.getElementById('jira-merge-comment-input');
        const jiraCommentButton = document.getElementById('add-jira-merge-comment-manually');

        jiraCommentButton.addEventListener('click', (ev) => {
            jiraCommentButton.disabled = true;
            commentInput.disabled = true;
            sendJiraComment(commentInput.value)
                .then(
                    (response) => {
                        console.info("Success, comment added.", response.status);
                        commentInput.insertAdjacentHTML('afterend', `<span>✔ Comment added</span>`);
                    },
                    (response) => {
                        console.error("Failed to add comment.", response.responseText);
                        jiraCommentButton.disabled = false;
                        commentInput.disabled = false;
                        commentInput.insertAdjacentHTML('afterend', `<span>❌ Adding comment failed</span>`);
                    }
                );
        });
    }

    function sendJiraComment(comment, success, error) {
        const key = getJiraIssueKeyFromTitle();
        console.debug(`Sending JIRA comment '${comment}' request on issue ${key}`, key);
        return addJiraComment({
            key: key,
            comment: comment,
            onSuccess: (response) => console.info("Success, comment added.", response.status),
            onError: (response) => console.error("Failed to add comment.", response.responseText)
        });
    }

    /**
     * @param {string} comment.key JIRA issue key string.
     * @param {string} comment.comment The comment text.
     * @param {Function} [comment.onReadyStateChange] Callback to be invoked when the request state changes.
     * @return {Promise} 
     */
    function addJiraComment(comment) {
        console.log(`Sending a comment request. Issue=${comment.key}, Comment="${comment.comment}"`);
        const body = `{ "body": "${comment.comment}" }`;
        return new Promise((resolve, reject) => {
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
                    onload: resolve,
                    onerror: reject
                }
            );
        });
    }

    /**
     * Activates all the enhancments.
     */
    function enhanceMergeRequestPage() {
        replaceIssueByLink(getTitle());
        addJiraCommentWidget();
    }

    enhanceMergeRequestPage();
})();
