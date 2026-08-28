
-- =============================================
-- Author:		Pat Relos
-- Create date: 1-27-2026
-- Description:	export data eot excel using spire 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkreport] 
	-- Add the parameters for the stored procedure here
	--	@idorganization integer
	@datestart date,
	@payrolldate date,
	@idclient int,
	@idbranch int,
	@idgroup int,
	@trxtype nvarchar(30)

AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT
    Employee.Employee_id                AS [Emp ID],
	Employee.lname                      AS [Last Name],
    Employee.fname                      AS [First Name],
    client_branch_position.jobposition AS [Job Position],
    Employee.datehired                  AS [Date Hired],
    client_branch_position.dailyratepayroll AS [Daily Rate],
	tbl_timekeep.allowance              AS Allowance,
    tbl_timekeep.tardiness              AS [Lates],
	tbl_timekeep.actualregularhours     AS [TOTAL HOURS],
	ROUND(CAST(tbl_timekeep.noofhourswork AS DECIMAL(10,2)) / 8, 2) AS [TOTAL DAYS],
	tbl_timekeep.noofhourswork			AS [RH],
	tbl_timekeep.Overtime_Hours			AS [RHOT],
	tbl_timekeep.Nightdiff_Hours		AS [RHND],
	tbl_timekeep.regularnightshiftOT_hours	AS [RHNDOT],

	tbl_timekeep.LegalHoliday_Hours	AS [LH],
	tbl_timekeep.LegalHoliday2_Hours AS [LH2],

	tbl_timekeep.LegalHolidayOT_Hours	AS [LHOT],
	tbl_timekeep.LegalHolidayND_Hours	AS [LHND],
	tbl_timekeep.uh						AS [UH],	
	tbl_timekeep.lhotndh				AS [LHNDOT],

	tbl_timekeep.Holiday_Special_Hours		AS [SH],
	tbl_timekeep.Holiday_Special2_Hours		AS [SH2],

	tbl_timekeep.Holiday_SpecialOT_Hours	AS [SHOT],
	tbl_timekeep.Holiday_SpecialND_Hours	AS [SHND],
	tbl_timekeep.shotndh					AS [SHNDOT],

	tbl_timekeep.rdhours					AS [RD],
	tbl_timekeep.RDothours					AS [RDOT],
	tbl_timekeep.RDNDhours					AS [RDND],
	tbl_timekeep.rdotndhours				AS [RDNDOT],
	
	tbl_timekeep.lhwdohours					AS [LHWDO],
	tbl_timekeep.lhwdoothours				AS [LHWDOOT],
	tbl_timekeep.lhwdondhours				AS [LHWDOND],
	tbl_timekeep.lhwdootndhours				AS [LHWDONDOT],

	tbl_timekeep.shwdohours					AS [SHWDO],
	tbl_timekeep.shwdoothours				AS [SHWDOOT],
	tbl_timekeep.shwdoNDhours				AS [SHWDOND],
	tbl_timekeep.shwdootndhours				AS [SHWDONDOT], 

	tbl_timekeep.WDOhours					AS [WDO], 
	tbl_timekeep.lhrdothours				AS [LHRDOT], 
	tbl_timekeep.shrdothours				AS [SHRDOT], 


	tbl_timekeep.food						AS [FOOD], 
	tbl_timekeep.charges					AS [CHARGES], 
	tbl_timekeep.shortage					AS [shortage], 
	
	ISNULL(tbl_timekeep.food, 0)
	+ ISNULL(tbl_timekeep.charges, 0)
	+ ISNULL(tbl_timekeep.shortage, 0)
	AS [TOTAL DEDUCTION],

	tbl_timekeep.uniformshortage			AS [UNIFORM ], 
	tbl_timekeep.nameplate					AS [NAME PLATE], 
	tbl_timekeep.allowance					AS [Allowance Billable],
	tbl_timekeep.incomeadjustment			AS [Income Adjustment],
	tbl_timekeep.allowancenb				AS [Allownace NB],
	tbl_timekeep.incomeadjustment			AS [Income Adjustment NB],



	tbl_timekeep.departmentdesc				AS [departmentcode]
	


FROM tbl_timekeep
INNER JOIN [GREENHRISMAIN].dbo.Employee
    ON tbl_timekeep.employeeid = Employee.Employee_id
INNER JOIN [GREENHRISMAIN].dbo.client_branch_position
    ON tbl_timekeep.idposition = client_branch_position.idbranchposition

	where	tbl_timekeep.datestart = @datestart
			AND tbl_timekeep.idclient = @idclient
			AND tbl_timekeep.idclientbranch =@idbranch	
			AND tbl_timekeep.departmentcode =@idgroup
			AND tbl_timekeep.trxtype =@trxtype 
			and tbl_timekeep.tkstatus In('Audited', 'Approved','Pending','For Audit')
ORDER BY
    [Last Name],
    [First Name];


END
