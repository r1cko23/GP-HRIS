
-- =============================================
-- Author:		Pat Relos
-- Create date: 1-27-2026
-- Description:	export data eot excel using spire 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tksummaryreport] 
	-- Add the parameters for the stored procedure here
	--	@idorganization integer
--	@datestart date,
	@payrolldate date,
	@trxtype nvarchar(30)

--	@idclient int,
--	@idbranch int,
--	@idgroup int,
--	@trxtype nvarchar(30)

AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT
    c.companyname AS [Client Name],
    tk.departmentdesc AS [Store/Group],
	tk.trxtype,

    SUM(ISNULL(tk.tardiness, 0)) AS [Lates],
    SUM(ISNULL(tk.actualregularhours, 0)) AS [Total Hours],

    ROUND(SUM(CAST(ISNULL(tk.noofhourswork, 0) AS DECIMAL(10,2))) / 8, 2) AS [Total Days],

    SUM(ISNULL(tk.noofhourswork, 0)) AS [RH],
    SUM(ISNULL(tk.Overtime_Hours, 0)) AS [RHOT],
    SUM(ISNULL(tk.Nightdiff_Hours, 0)) AS [RHND],
    SUM(ISNULL(tk.regularnightshiftOT_hours, 0)) AS [RHNDOT],

    SUM(ISNULL(tk.LegalHoliday_Hours, 0)) AS [LH],
    SUM(ISNULL(tk.LegalHolidayOT_Hours, 0)) AS [LHOT],
    SUM(ISNULL(tk.LegalHolidayND_Hours, 0)) AS [LHND],
    SUM(ISNULL(tk.uh, 0)) AS [UH],
    SUM(ISNULL(tk.lhotndh, 0)) AS [LHNDOT],

    SUM(ISNULL(tk.Holiday_Special_Hours, 0)) AS [SH],
    SUM(ISNULL(tk.Holiday_SpecialOT_Hours, 0)) AS [SHOT],
    SUM(ISNULL(tk.Holiday_SpecialND_Hours, 0)) AS [SHND],
    SUM(ISNULL(tk.shotndh, 0)) AS [SHNDOT],

    SUM(ISNULL(tk.rdhours, 0)) AS [RD],
    SUM(ISNULL(tk.RDothours, 0)) AS [RDOT],
    SUM(ISNULL(tk.RDNDhours, 0)) AS [RDND],
    SUM(ISNULL(tk.rdotndhours, 0)) AS [RDNDOT],

    SUM(ISNULL(tk.lhwdohours, 0)) AS [LHWDO],
    SUM(ISNULL(tk.lhwdoothours, 0)) AS [LHWDOOT],
    SUM(ISNULL(tk.lhwdondhours, 0)) AS [LHWDOND],
    SUM(ISNULL(tk.lhwdootndhours, 0)) AS [LHWDONDOT],

    SUM(ISNULL(tk.shwdohours, 0)) AS [SHWDO],
    SUM(ISNULL(tk.shwdoothours, 0)) AS [SHWDOOT],
    SUM(ISNULL(tk.shwdoNDhours, 0)) AS [SHWDOND],
    SUM(ISNULL(tk.shwdootndhours, 0)) AS [SHWDONDOT],

    SUM(ISNULL(tk.WDOhours, 0)) AS [WDO],

    SUM(ISNULL(tk.food, 0)) AS [FOOD],
    SUM(ISNULL(tk.charges, 0)) AS [CHARGES],
    SUM(ISNULL(tk.shortage, 0)) AS [SHORTAGE],

    SUM(
        ISNULL(tk.food, 0) +
        ISNULL(tk.charges, 0) +
        ISNULL(tk.shortage, 0)
    ) AS [TOTAL DEDUCTION],

    SUM(ISNULL(tk.uniformshortage, 0)) AS [UNIFORM],
    SUM(ISNULL(tk.nameplate, 0)) AS [NAME PLATE]

FROM tbl_timekeep tk

INNER JOIN GREENHRISMAIN.dbo.Employee e
    ON tk.employeeid = e.Employee_id

INNER JOIN GREENHRISMAIN.dbo.client_branch_position cbp
    ON tk.idposition = cbp.idbranchposition

INNER JOIN client c   -- ✅ FIXED
    ON tk.idclient = c.idclient

WHERE tk.payrolldate = @payrolldate
AND tkstatus = 'Audited' or tkstatus= 'Approved'
AND (@trxtype IS NULL OR trxtype = @trxtype)
  
GROUP BY 
    c.companyname,
    tk.departmentdesc,
	tk.trxtype

ORDER BY 
    tk.departmentdesc;
END
