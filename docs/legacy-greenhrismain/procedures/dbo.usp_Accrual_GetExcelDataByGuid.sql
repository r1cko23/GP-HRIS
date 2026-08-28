

-- =================================================
-- Author:		Nianz
-- Create date: 18.Oct.2022 03:53
-- Description:	Get records for Excel Acrual by Guid
-- =================================================
CREATE PROCEDURE [dbo].[usp_Accrual_GetExcelDataByGuid]
	@Guid VarChar(100)
AS
BEGIN
	SELECT 
		CAST(ae.RecordNo AS nvarchar(3)) as [#]
		,(CASE WHEN ae.[EmployeeId] = 0 THEN '' ELSE CAST(ae.[EmployeeId] AS VarChar(10)) END)  as [Emp ID]
		,[Name] as [Employee Name]
		,ae.[Position] 
		,[Late_UT_Hours] as [Late/UT]
		,[Rate_Daily] as [Daily Rate]
		--,[Rate_Hourly] as [Hourly Rate]
		,[Regular_Days] as [Reg Days]
		,[Regular_Hours] as [Reg Hours]
		,[Regular_OT] as [Reg OT]
		,[Regular_ND] as [Reg ND]
		,[Regular_NDOT] as [Reg NDOT]
		,[Legal_NoWork_Hours] as [LEGAL No Work]
		,[LegalHoliday_Hours] as [LH Hours]
		,[LegalHoliday_OT] as [LHOT Hours]
		,[LegalHoliday_ND] as [LHND Hours]
		,[LegalHoliday_NDOT] as [LHNOT Hours]
		,[SpecialHoliday_Hours] as [SH Hours]
		,[SpecialHoliday_OT] as [SHOT Hours]
		,[SpecialHoliday_ND] as [SHND Hours]
		,[SpecialHoliday_NDOT] as [SHNDOT Hours]
		,[RestDay_Hours] as [RD Hours]
		,[RestDay_Hours_SH_OT] as [SHRDOT Hours]
		,[RestDay_Hours_LH_OT] As [LHRDOT Hours]
		,[RestDay_Hours_WDO] AS [WDO Hours]
		,[sssamt] AS [SSS Amt]
		,[philhealthamt] AS [PhilhealthAmt]
		,[pagibigamt] AS [PagibigAmt]
		,[dupstag] = ISNULL(ae.DupsTag, 0)
		--,ISNULL(ae.DupsTag, CASE
		--	WHEN uniq.idclient <> ae.idClient THEN 4
		--	WHEN ae.[EmployeeId] = 0 THEN 3
		--	ELSE ISNULL(uniq.Dups, 2)
		--END) AS [dupstag]
		,ae.ToolTipText
		,ae.RecordNo

	--	,[dupsId]= uniq.id

	FROM [hrismain].[dbo].[AccrualExcel]  ae
		--LEFT JOIN (SELECT
		--				[id] = MIN(id),
		--				e.idclient,
		--				EmployeeId,
		--				cbp.jobposition,
		--				[Dups] = '0'
		--			FROM 
		--				[dbo].[AccrualExcel] ae
		--				INNER JOIN [dbo].[Employee] e ON e.Employee_id = ae.EmployeeId
		--				INNER JOIN client_branch_position cbp ON cbp.idbranchposition = e.Position1
		--			WHERE
		--				ae.Guid = @Guid
		--			GROUP BY EmployeeId, cbp.jobposition, e.idclient 
		--) uniq ON uniq.EmployeeId= ae.EmployeeId AND uniq.jobposition = ae.Position
	WHERE 					
		[Guid] = @Guid

	UNION ALL

	SELECT
		[#] = ''
		,[Emp ID] = ''
		,[Employee Name] = ''
		,[Position] = 'TOTAL:'  
		,SUM([Late_UT_Hours]) as [Late/UT]
		,SUM([Rate_Daily]) as [Daily Rate]
		--,SUM([Rate_Hourly]) as [Hourly Rate]
		,SUM([Regular_Days]) as [Reg Days]
		,SUM([Regular_Hours]) as [Reg Hours]
		,SUM([Regular_OT]) as [Reg OT]
		,SUM([Regular_ND]) as [Reg ND]
		,SUM([Regular_NDOT]) as [Reg NDOT]
		,SUM([Legal_NoWork_Hours]) as [LEGAL No Work]
		,SUM([LegalHoliday_Hours]) as [LH Hours]
		,SUM([LegalHoliday_OT]) as [LHOT Hours]
		,SUM([LegalHoliday_ND]) as [LHND Hours]
		,SUM([LegalHoliday_NDOT]) as [LHNOT Hours]
		,SUM([SpecialHoliday_Hours]) as [SH Hours]
		,SUM([SpecialHoliday_OT]) as [SHOT Hours]
		,SUM([SpecialHoliday_ND]) as [SHND Hours]
		,SUM([SpecialHoliday_NDOT]) as [SHNDOT Hours]
		,SUM([RestDay_Hours]) as [RD Hours]
		,SUM([RestDay_Hours_SH_OT]) as [SHRDOT Hours]
		,SUM([RestDay_Hours_LH_OT]) As [LHRDOT Hours]
		,SUM([RestDay_Hours_WDO]) AS [WDO Hours]
		,SUM([sssamt]) AS [SSS Amt]
		,SUM([philhealthamt]) AS [Philhealthamt]
		,SUM([pagibigamt]) AS [Pagibigamt]
		,[dupstag] = 0
		,[ToolTipText] = 'Total/Sum'
		,[RecordNo] = 999999
	FROM [dbo].[AccrualExcel]  ae
	WHERE ae.Guid = @Guid
	GROUP BY ae.Guid  

	ORDER BY RecordNo

END
