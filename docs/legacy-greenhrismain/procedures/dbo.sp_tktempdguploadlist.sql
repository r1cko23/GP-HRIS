
-- =============================================
-- Author:		Pat Relos
-- Create date: 2023.July.04 @ 04:03
-- Description:	list if employee store in timekeep data grid 
-- =============================================
create PROCEDURE [dbo].[sp_tktempdguploadlist] 
	-- Add the parameters for the stored procedure here
	@idclient Int, 
	@iddepartment int,
	@datestart date
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	BEGIN TRY
		BEGIN TRANSACTION; -- Start a transaction to rollback changes in case of an error


SELECT        tktemp.idtimekeeptemp, tktemp.employeeid, e.lname, e.fname, e.lname + ', ' + e.fname + ISNULL(' ' + LEFT(e.mname, 1) + '.', '') AS empname, tktemp.idposition, tktemp.positiondesc, tktemp.dailyrate_payroll, tktemp.tkstatus, 
                         tktemp.datestart, tktemp.dateend, tktemp.payrolldate, tktemp.payrollyear, tktemp.payrollmonth, tktemp.idclient, tktemp.departmentcode, Department.Department_desc, tktemp.actualregularhours, tktemp.noofhourswork, 
                         tktemp.Overtime_Hours, tktemp.Nightdiff_Hours, tktemp.regularnightshiftOT_hours, client_branch_position_1.dailyratepayroll
FROM            client_branch_position AS client_branch_position_1 INNER JOIN
                         tbl_timekeeptemp AS tktemp INNER JOIN
                         Employee AS e ON tktemp.employeeid = e.Employee_id INNER JOIN
                         Department ON tktemp.departmentcode = Department.iddepartment ON client_branch_position_1.idbranchposition = tktemp.idposition
--WHERE tktemp.idclient = @idclient
--AND tktemp.departmentcode = @iddepartment
--AND tktemp.datestart = @datestart
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
