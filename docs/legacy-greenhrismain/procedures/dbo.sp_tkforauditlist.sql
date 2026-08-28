
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	list if employee store in timekeep data grid 
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkforauditlist] 
	-- Add the parameters for the stored procedure here
	@idclient Int, 
	@iddepartment int,
	@datestart date,
	@trxtype nvarchar(30),
	@tkstatus nvarchar(30)
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error


SELECT        
  tk.id,
  tk.idtimekeep,
  tk.employeeid,
  e.lname,
  e.fname,
  e.lname + ', ' + e.fname + ISNULL(' ' + LEFT(e.mname, 1) + '.', '') AS empname,
  tk.idposition,
  tk.positiondesc,
  tk.dailyrate_payroll,
  tk.tkstatus,
  tk.datestart,
  tk.dateend,
  tk.payrolldate,
  tk.payrollyear,
  tk.payrollmonth,
  tk.idclient,
  tk.departmentcode,
  d.Department_desc,
  tk.actualregularhours,
  tk.noofhourswork,
  tk.Overtime_Hours,
  tk.Nightdiff_Hours,
  tk.regularnightshiftOT_hours,

  tk.LegalHoliday_Hours,
  tk.LegalHolidayOT_Hours,
  tk.LegalHolidayND_Hours,
  tk.lhotndh,

  tk.LegalHoliday2_Hours,
  
		  		  

  tk.Holiday_Special_Hours,
  tk.Holiday_SpecialOT_Hours,
  tk.Holiday_SpecialND_Hours,
  tk.shotndh,


  tk.Holiday_Special2_Hours,

  tk.rdhours,
  tk.RDothours,
  tk.rdndhours,
  tk.rdotndhours,

  tk.lhwdohours,
  tk.lhwdoothours,
  tk.lhwdondhours,
  tk.lhwdootndhours,

  tk.shwdohours,
  tk.shwdoothours,
  tk.shwdondhours,
  tk.shwdootndhours,

  tk.allowance,
  tk.totaldeduction,
  tk.uniformshortage,
  tk.nameplate,
  tk.WDOhours,
  client_branch_position.dailyratepayroll,
  tk.tardiness

FROM [GREENHRISMAIN].dbo.client_branch_position 
INNER JOIN tbl_timekeep AS tk 
    ON client_branch_position.idbranchposition = tk.idposition
INNER JOIN [GREENHRISMAIN].dbo.Employee AS e 
    ON tk.employeeid = e.Employee_id
INNER JOIN [GREENHRISMAIN].dbo.Department AS d
    ON tk.departmentcode = d.iddepartment

WHERE tk.idclient = @idclient
AND tk.departmentcode = @iddepartment
AND tk.trxtype = @trxtype
AND (tk.tkstatus = @tkstatus)
AND tk.datestart = @datestart

order by e.lname, e.fname

--AND payroll_summary.department_codep = @iddepartment
--and payroll_summary.idclientbranchp = @idclientbranch
--AND (payroll_summary.fname2 LIKE '%' + @filtertxt + '%'
--OR payroll_summary.lname2 LIKE '%' + @filtertxt + '%'
--OR payroll_summary.jobposition2 LIKE '%' + @filtertxt + '%')
--order by lname,fname
		
		COMMIT TRANSACTION; -- Commit the transaction if everything is successful
	
	END TRY
	BEGIN CATCH
		IF @@TRANCOUNT > 0
			ROLLBACK TRANSACTION; -- Rollback the transaction in case of an error

		-- Log or handle the error as per your requirements
		-- Example: Raising an error and returning the error message to the caller
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT 
			@ErrorMessage = ERROR_MESSAGE(),
			@ErrorSeverity = ERROR_SEVERITY(),
			@ErrorState = ERROR_STATE();

		RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
		RETURN;
	END CATCH;
END
