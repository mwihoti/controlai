import { NextResponse } from "next/server";
import { buildHeuristicReport, refineWithGemini } from "../../../../../lib/analysis";
import { defaultOrganizationName, isDatabaseConfigured } from "../../../../../lib/env";
import { buildLiveRepoSignalsWithToken, parseGitHubRepoUrl } from "../../../../../lib/github-live";
import { persistRiskReport, persistWorkerSignals } from "../../../../../lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      repoUrl?: string;
      organizationSlug?: string;
      organizationName?: string;
      persist?: boolean;
      prompt?: string;
    };

    if (!body.repoUrl) {
      return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
    }

    const repoRef = parseGitHubRepoUrl(body.repoUrl);
    const authSource = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT ? "server-github-token" : "public-github-api";

    const source = await buildLiveRepoSignalsWithToken(
      body.repoUrl,
      process.env.GITHUB_TOKEN || process.env.GITHUB_PAT || undefined
    );
    const base = buildHeuristicReport(source.workers, body.prompt || "", {
      sourceMetadata: source.sourceDetails
    });
    const enhanced = await refineWithGemini(base, body.prompt || "", source.workers, {
      sourceMetadata: source.sourceDetails
    });

    let reportId: string | null = null;
    const organizationSlug = body.organizationSlug || repoRef.owner.toLowerCase();
    const organizationName = body.organizationName || `${defaultOrganizationName()} • ${source.repository.full_name}`;

    if (body.persist && isDatabaseConfigured()) {
      await persistWorkerSignals({
        organizationSlug,
        organizationName,
        provider: "github-live",
        workers: source.workers,
        configJson: {
          repoUrl: body.repoUrl,
          repoFullName: source.sourceDetails.repoFullName,
          defaultBranch: source.repository.default_branch,
          openPullRequests: source.sourceDetails.openPullRequests,
          openIssues: source.sourceDetails.openIssues,
          mergedPullRequests: source.sourceDetails.mergedPullRequests,
          closedIssues: source.sourceDetails.closedIssues,
          analyzedOpenPullRequests: source.sourceDetails.analyzedOpenPullRequests,
          analyzedOpenIssues: source.sourceDetails.analyzedOpenIssues,
          analyzedClosedPullRequests: source.sourceDetails.analyzedClosedPullRequests,
          analyzedClosedIssues: source.sourceDetails.analyzedClosedIssues,
          lastPushAt: source.sourceDetails.lastPushAt,
          contributorCount: source.sourceDetails.contributorCount,
          topContributors: source.sourceDetails.topContributors,
          maintainerEffortScore: source.sourceDetails.maintainerEffortScore,
          maintainerEffortRating: source.sourceDetails.maintainerEffortRating,
          contributorEffortScore: source.sourceDetails.contributorEffortScore,
          contributorEffortRating: source.sourceDetails.contributorEffortRating,
          mergedPullRequests7d: source.sourceDetails.mergedPullRequests7d,
          mergedPullRequests30d: source.sourceDetails.mergedPullRequests30d,
          closedIssues7d: source.sourceDetails.closedIssues7d,
          closedIssues30d: source.sourceDetails.closedIssues30d,
          averageMergeLeadHours: source.sourceDetails.averageMergeLeadHours,
          openPrGrowthPressure: source.sourceDetails.openPrGrowthPressure,
          topMergedPullRequests: source.sourceDetails.topMergedPullRequests,
          oldestOpenPullRequests: source.sourceDetails.oldestOpenPullRequests,
          recentlyClosedIssues: source.sourceDetails.recentlyClosedIssues,
          oldestOpenIssues: source.sourceDetails.oldestOpenIssues
        },
        detailsJson: source.sourceDetails
      });
      reportId = await persistRiskReport(organizationSlug, enhanced, body.prompt || "");
    }

    return NextResponse.json({
      repo: source.repository,
      sourceDetails: source.sourceDetails,
      authSource,
      workers: source.workers,
      report: {
        ...enhanced,
        reportId
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected GitHub live sync error" },
      { status: 500 }
    );
  }
}
